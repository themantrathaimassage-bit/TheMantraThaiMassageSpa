// Token is injected by the Express backend (server.js) via OAuth — no hardcoded token needed
const LOCATION_ID = 'LY3JYWKY4FHHQ';
const HEADERS = {
    'Square-Version': '2024-01-17',
    'Content-Type': 'application/json',
};

/**
 * Search for an existing Square customer by phone number.
 */
export async function searchSquareCustomer(phone) {
    const searchRes = await fetch('/api/square/v2/customers/search', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
            query: {
                filter: {
                    phone_number: { exact: phone }
                }
            }
        })
    });
    const searchData = await searchRes.json();
    return (searchData.customers && searchData.customers.length > 0) ? searchData.customers[0] : null;
}

/**
 * Find an existing Square customer by phone number, or create a new one.
 * Phone should be in E.164 format e.g. +61412345678
 * Returns { id, given_name, family_name, phone_number } or throws.
 */
export async function findOrCreateSquareCustomer({ phone, firstName = '', lastName = '' }) {
    // 1. Search by phone number
    const existing = await searchSquareCustomer(phone);

    if (existing) {
        // If we now have a name (name step) and customer had none, update it
        if (firstName && !existing.given_name) {
            await fetch(`/api/square/v2/customers/${existing.id}`, {
                method: 'PUT',
                headers: HEADERS,
                body: JSON.stringify({ given_name: firstName, family_name: lastName }),
            });
            return { ...existing, given_name: firstName, family_name: lastName };
        }
        return existing;
    }

    // 2. Create new customer
    const createRes = await fetch('/api/square/v2/customers', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
            idempotency_key: `customer-phone-${phone.replace(/\D/g, '')}-${Date.now()}`,
            given_name: firstName,
            family_name: lastName,
            phone_number: phone,
        })
    });
    const createData = await createRes.json();

    if (!createRes.ok || createData.errors) {
        const errMsg = createData.errors?.[0]?.detail || `HTTP ${createRes.status}`;
        throw new Error(errMsg);
    }

    return createData.customer;
}


/**
 * Fetch all bookable services (+ add-ons) from Square Catalog API.
 * Returns data in the same format as servicesData.js:
 * [{ category: string, items: [{ id, name, duration, durationMs, price, description, isAddon }] }]
 */

// ── Overtime Charge Service (from Square catalog "over time charge") ──────────
// Variations keyed by OVERTIME MINUTES (15 min = $5, 30 min = $10, etc.)
const OVERTIME_ITEM_ID = 'IUV27ZFAY3H4NRC7TXNLMPUI';
const OT_VERSION = 1772196501587;
const OVERTIME_VARIATIONS = {
    15: { id: '4MS5UIXPM5J7PTIEDUJPWFHY', version: OT_VERSION, price: 5 },
    30: { id: 'HFQBUIH7RBVGF4R6UCDLUB6Y', version: OT_VERSION, price: 10 },
    45: { id: 'YASVDMSWCNMIPXDYTXUMXMYF', version: OT_VERSION, price: 15 },
    60: { id: 'FLU2L6LRG53FNFGNTH3NL6B5', version: OT_VERSION, price: 20 },
    75: { id: '2W4RDPZCPMNCAP236H5BP4VW', version: OT_VERSION, price: 25 },
    90: { id: 'AGZRQAC5J5SPU6ZMU5PEDV6H', version: OT_VERSION, price: 30 },
    105: { id: 'VQRJJJ4ZVYT7VEG6CAR2P4NP', version: OT_VERSION, price: 35 },
    120: { id: '5HADX7QYPN2MV2Q43V5E7MXK', version: OT_VERSION, price: 40 },
};

/**
 * Get the overtime charge service variation for given overtime MINUTES.
 * Rounds up to nearest 15-min bracket (max 120 min = $40).
 */
export function getOvertimeVariation(amount, overtimeMins = 0) {
    if (!overtimeMins || overtimeMins <= 0) return null;
    const bracket = Math.ceil(overtimeMins / 15) * 15;
    const capped = Math.min(bracket, 120);
    const variation = OVERTIME_VARIATIONS[capped];
    if (!variation) return null;
    return {
        id: variation.id,
        version: variation.version,
        name: `Over Time Charge`,
        baseServiceName: 'over time charge',
        price: variation.price,
        duration: `${overtimeMins} min over`,
        durationMs: 0,
        isAddon: true,
        isOvertime: true,
        overtimeMins: capped,
    };
}

// Simple in-memory cache to avoid hitting Square rate limits (5 min TTL)
let _servicesCache = null;
let _servicesCacheTime = 0;
const SERVICES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchSquareServices() {
    // Return cache if still fresh
    if (_servicesCache && (Date.now() - _servicesCacheTime) < SERVICES_CACHE_TTL) {
        return _servicesCache;
    }
    try {
        const response = await fetch('/api/square/v2/catalog/list?types=ITEM,CATEGORY', {
            headers: HEADERS,
        });

        if (!response.ok) {
            // If rate limited, return stale cache if available
            if (response.status === 429 && _servicesCache) {
                console.warn('Square rate limited — serving stale catalog cache');
                return _servicesCache;
            }
            throw new Error(`Square API error: ${response.status}`);
        }

        const data = await response.json();
        const objects = data.objects || [];

        // Build category map: id → { name, ordinal }
        const categories = {};
        const items = [];

        objects.forEach(obj => {
            if (obj.type === 'CATEGORY') {
                categories[obj.id] = {
                    name: obj.category_data?.name || 'Other',
                    ordinal: obj.category_data?.parent_category?.ordinal ?? 0,
                };
            } else if (obj.type === 'ITEM') {
                items.push(obj);
            }
        });

        // grouped: categoryName → { ordinal, services: { itemName: { name, description, isAddon, variations: [] } } }
        const grouped = {};

        items.forEach(item => {
            const itemData = item.item_data || {};

            // Square API v2 uses `categories` (array) instead of `category_id`
            const categoryRef = (itemData.categories && itemData.categories.length > 0)
                ? itemData.categories[0]
                : null;
            const categoryInfo = categoryRef && categories[categoryRef.id]
                ? categories[categoryRef.id]
                : { name: itemData.name || 'Other', ordinal: 0 };
            const categoryName = categoryInfo.name;
            const categoryOrdinal = categoryInfo.ordinal;

            if (!grouped[categoryName]) {
                grouped[categoryName] = { ordinal: categoryOrdinal, services: {} };
            }

            const itemName = itemData.name || 'Unnamed Service';
            if (!grouped[categoryName].services[itemName]) {
                grouped[categoryName].services[itemName] = {
                    name: itemName,
                    description: itemData.description || '',
                    variations: []
                };
            }

            const itemVariations = itemData.variations || [];

            itemVariations.forEach(variation => {
                const varData = variation.item_variation_data || {};
                const durationMs = varData.service_duration || 0;
                const isBookable = varData.available_for_booking === true;
                if (!isBookable && durationMs > 0) return;

                const priceMoney = varData.price_money;
                const price = priceMoney ? Math.round(priceMoney.amount / 100) : 0;
                const duration = formatDuration(durationMs);

                const description = itemData.description || '';
                const isAddon = durationMs === 0 ||
                    description.includes('[ADD ON]') ||
                    categoryName.toLowerCase().includes('add') ||
                    categoryName.toLowerCase().includes('enhancement') ||
                    itemData.name?.toLowerCase().includes('add-on') ||
                    itemData.name?.toLowerCase().includes('addon') ||
                    itemData.name?.toLowerCase().includes('add on');

                grouped[categoryName].services[itemName].isAddon = isAddon;
                // Strip [ADD ON] tag from description for display
                grouped[categoryName].services[itemName].description =
                    description.replace(/\[ADD ON\]/gi, '').trim();
                grouped[categoryName].services[itemName].variations.push({
                    id: variation.id,
                    version: variation.version,
                    name: variation.item_variation_data?.name || 'Regular',
                    fullName: itemVariations.length === 1 ? itemName : `${itemName} (${varData.name})`,
                    duration,
                    durationMs,
                    price,
                    isBookable,
                });
            });
        });

        // Sort categories by their ordinal, and flatten services into arrays
        const result = Object.entries(grouped)
            .map(([category, data]) => {
                const servicesList = Object.values(data.services)
                    .filter(s => s.variations.length > 0)
                    .map(s => ({
                        ...s,
                        // Sort variations by duration
                        variations: s.variations.sort((a, b) => a.durationMs - b.durationMs)
                    }));
                return { category, services: servicesList, ordinal: data.ordinal };
            })
            .filter(cat => cat.services.length > 0)
            .sort((a, b) => a.ordinal - b.ordinal)
            .map(({ category, services }) => ({ category, items: services })); // name "items" kept for backward compat maybe, but it's now services


        // Save to cache
        _servicesCache = result;
        _servicesCacheTime = Date.now();

        return result;

    } catch (error) {
        console.error('Failed to fetch Square catalog:', error);
        // Return stale cache on any error rather than null
        return _servicesCache || null;
    }
}

/**
 * Fetch all active team members from Square.
 */
export async function fetchSquareTeamMembers() {
    try {
        // 1. Try Bookings API (specifically for booking profiles which contain display_name)
        const staffRes = await fetch(`/api/square/v2/bookings/team-member-booking-profiles?location_id=${LOCATION_ID}`, {
            headers: HEADERS,
        });
        if (staffRes.ok) {
            const staffData = await staffRes.json();
            if (staffData.team_member_booking_profiles && staffData.team_member_booking_profiles.length > 0) {
                // Filter for bookable and map to match expected format in BookingPage
                return staffData.team_member_booking_profiles.filter(p => p.is_bookable);
            }
        }

        // 2. Fallback to Team API search if Bookings API is empty or fails
        const teamRes = await fetch('/api/square/v2/team-members/search', {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                query: {
                    filter: {
                        status: 'ACTIVE'
                        // Removed location_ids filter to ensure all active staff are found
                    }
                }
            })
        });

        if (!teamRes.ok) throw new Error('API Error');
        const teamData = await teamRes.json();
        return teamData.team_members || [];
    } catch (error) {
        console.error('Failed to fetch team members:', error);
        return [];
    }
}

/**
 * Fetch location details from Square (name, address, hours).
 */
export async function fetchSquareLocation() {
    try {
        const response = await fetch(`/api/square/v2/locations/${LOCATION_ID}`, {
            headers: HEADERS,
        });
        if (!response.ok) throw new Error('Failed to fetch location');
        const data = await response.json();
        const loc = data.location;

        // Map Square business_hours to the format expected by the UI
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayMap = {
            'SUN': 'Sunday', 'MON': 'Monday', 'TUE': 'Tuesday', 'WED': 'Wednesday',
            'THU': 'Thursday', 'FRI': 'Friday', 'SAT': 'Saturday'
        };
        const openingHours = (loc.business_hours?.periods || []).map(p => {
            const formatTime = (t) => {
                if (!t) return '??:??';
                const parts = t.split(':');
                if (parts.length < 2) return t;
                const [h, m] = parts.map(Number);
                const ampm = h >= 12 ? 'pm' : 'am';
                const h12 = h % 12 || 12;
                return `${h12}:${String(m).padStart(2, '0')}${ampm}`;
            };
            return {
                day: dayMap[p.day_of_week] || days[p.day_of_week === 7 ? 0 : p.day_of_week] || 'Unknown',
                hours: `${formatTime(p.start_local_time || p.start_time)} - ${formatTime(p.end_local_time || p.end_time)}`
            };
        });

        // Ensure all days are represented, even if closed
        const fullHours = days.map(day => {
            const existing = openingHours.find(h => h.day === day);
            return existing || { day, hours: 'Closed' };
        });

        return {
            name: loc.name,
            address: `${loc.address?.address_line_1}, ${loc.address?.locality} ${loc.address?.administrative_district_level_1} ${loc.address?.postal_code}`,
            location: loc.address?.locality + ', ' + loc.address?.administrative_district_level_1,
            openingHours: fullHours,
            description: loc.description
        };
    } catch (err) {
        console.error('Failed to fetch Square location:', err);
        return null;
    }
}

/**
 * Get a Square customer booking token for the given customer.
 * This token allows creating bookings on behalf of the customer
 * without requiring the merchant to have an Appointments subscription.
 */
async function getCustomerBookingToken(customerId) {
    const res = await fetch(`/api/square/v2/customers/${customerId}/custom-attribute-definitions`, {
        method: 'GET',
        headers: HEADERS,
    }).catch(() => null);

    // Try the dedicated customer token endpoint
    const tokenRes = await fetch(`/api/square/v2/bookings/booking-enquiries`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ customer_id: customerId }),
    }).catch(() => null);

    // Square customer booking token endpoint
    const resp = await fetch('/api/square/v2/customers/' + customerId + '/bookings/custom-token', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({}),
    }).catch(() => null);

    if (resp?.ok) {
        const data = await resp.json();
        return data?.token || null;
    }
    return null;
}

/**
 * Create bookings in Square for each guest.
 * Parallelized for maximum speed.
 */
export async function createSquareBookings(guests, customerId) {
    const bookingPromises = guests.map(async (guest) => {
        if (!guest.services?.length || !guest.time) return null;

        const bookableServices = guest.services.filter(s => s.durationMs > 0);
        if (bookableServices.length === 0) {
            return { guest: guest.name, skipped: true, reason: 'Add-on only' };
        }

        const { date, time, availability } = guest.time;
        const [hours, minutes] = time.split(':').map(Number);
        const pad = n => String(n).padStart(2, '0');
        const dObj = new Date(date.date);
        const startAt = `${date.year}-${pad(dObj.getMonth() + 1)}-${pad(date.dayNum)}T${pad(hours)}:${pad(minutes)}:00+11:00`;

        // If no availability object (dim slot), re-fetch to find an available team member
        let resolvedAvailability = availability;
        if (!resolvedAvailability && (!guest.staff || guest.staff.id === 'any')) {
            try {
                // end = start + 1 min so Square returns that exact slot
                const endObj = new Date(`${date.year}-${pad(dObj.getMonth() + 1)}-${pad(date.dayNum)}T${pad(hours)}:${pad(minutes)}:00+11:00`);
                endObj.setMinutes(endObj.getMinutes() + 1);
                const endAtStr = endObj.toISOString().replace('Z', '+11:00');
                const res = await fetch('/api/square/v2/bookings/availability/search', {
                    method: 'POST',
                    headers: HEADERS,
                    body: JSON.stringify({
                        query: {
                            filter: {
                                location_id: LOCATION_ID,
                                start_at_range: { start_at: startAt, end_at: endAtStr },
                                segment_filters: bookableServices.map(s => ({
                                    service_variation_id: s.id,
                                }))
                            }
                        }
                    })
                });
                const data = await res.json();
                console.log('[re-fetch availability]', data);
                if (data.availabilities?.length > 0) {
                    resolvedAvailability = data.availabilities[0];
                }
            } catch (e) {
                console.warn('Could not re-fetch availability for dim slot:', e);
            }
        }

        const segments = bookableServices.map(service => {
            const availSeg = (resolvedAvailability?.appointment_segments || []).find(s => s.service_variation_id === service.id)
                || (resolvedAvailability?.appointment_segments || [])[0];
            const teamMemberId = (guest.staff && guest.staff.id !== 'any')
                ? guest.staff.id
                : availSeg?.team_member_id;

            return {
                service_variation_id: service.id,
                service_variation_version: service.version,
                duration_minutes: Math.round(service.durationMs / 60000),
                ...(teamMemberId ? { team_member_id: teamMemberId } : {})
            };
        });

        // Append overtime charge as an extra segment (uses same team member as first segment)
        const overtimeService = guest.services.find(s => s.isOvertime);
        if (overtimeService && overtimeService.overtimeMins > 0) {
            const firstTeamMemberId = segments[0]?.team_member_id;
            segments.push({
                service_variation_id: overtimeService.id,
                service_variation_version: overtimeService.version,
                duration_minutes: overtimeService.overtimeMins,
                ...(firstTeamMemberId ? { team_member_id: firstTeamMemberId } : {})
            });
        }

        // Append zero-duration add-ons (e.g. enhancements priced separately)
        // These won't affect slot availability but need to appear in Square's booking record
        const zeroDurationAddons = guest.services.filter(s => s.isAddon && !s.isOvertime && s.durationMs === 0);
        zeroDurationAddons.forEach(addon => {
            const firstTeamMemberId = segments[0]?.team_member_id;
            segments.push({
                service_variation_id: addon.id,
                ...(addon.version ? { service_variation_version: addon.version } : {}),
                duration_minutes: 0,
                ...(firstTeamMemberId ? { team_member_id: firstTeamMemberId } : {})
            });
        });

        try {
            const resp = await fetch('/api/square/v2/bookings', {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({
                    idempotency_key: `book-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    booking: { location_id: LOCATION_ID, start_at: startAt, appointment_segments: segments, customer_id: customerId }
                }),
            });
            const data = await resp.json();

            if (!resp.ok) {
                const err = data.errors?.[0];
                console.error('[Square booking error]', JSON.stringify(data.errors, null, 2));
                let msg = err?.detail || 'Booking failed';

                // Friendly mapping
                if (msg.toLowerCase().includes('time slot is no longer available') ||
                    msg.toLowerCase().includes('no longer available')) {
                    msg = 'Sorry, this time slot was just taken. Please select another time.';
                } else if (msg.toLowerCase().includes('team member') && msg.toLowerCase().includes('not available')) {
                    msg = 'The selected time is outside staff working hours. Please choose an earlier time or call us to arrange.';
                } else if (msg.includes('only be made in the future')) {
                    msg = 'This time slot has already passed. Please select a future time.';
                } else if (err?.category === 'AUTHENTICATION_ERROR') {
                    msg = 'Session expired, please refresh.';
                }
                throw new Error(msg);
            }
            return { guest: guest.name, booking: data.booking };
        } catch (err) {
            return { guest: guest.name, error: err.message };
        }
    });

    const results = await Promise.all(bookingPromises);
    const validResults = results.filter(Boolean);

    // Rollback logic: if any booking failed, cancel all successful ones in this batch.
    const hasError = validResults.some(r => r.error);
    if (hasError) {
        const successes = validResults.filter(r => !r.error && !r.skipped && r.booking?.id);
        const cancelPromises = successes.map(async (r) => {
            try {
                await fetch(`/api/square/v2/bookings/${r.booking.id}/cancel`, {
                    method: 'POST',
                    headers: HEADERS,
                    body: JSON.stringify({
                        idempotency_key: `cancel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
                    })
                });
            } catch (e) {
                console.error(`Failed to rollback booking ${r.booking.id}`, e);
            }
            // Overwrite result so UI knows this person wasn't booked either due to rollback
            r.error = 'Booking aborted because another guest\'s booking failed.';
        });
        await Promise.all(cancelPromises);
    }

    return validResults;
}

/**
 * Search for bookings associated with a customer ID.
 */
export async function searchSquareBookings(customerId) {
    try {
        const response = await fetch('/api/square/v2/bookings/search', {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                query: {
                    filter: {
                        customer_id: customerId,
                        // Could add filters for status or dates here
                    }
                }
            })
        });
        const data = await response.json();
        if (!response.ok) {
            console.error('Square search error:', data.errors);
            throw new Error(data.errors?.[0]?.detail || 'Failed to search bookings');
        }
        return data.bookings || [];
    } catch (error) {
        console.error('Failed to fetch Square bookings:', error);
        throw error;
    }
}

/**
 * Convert milliseconds to human-readable duration string
 */
function formatDuration(ms) {
    if (!ms) return 'Add-on';
    const totalMinutes = Math.round(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `${minutes}min`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}
