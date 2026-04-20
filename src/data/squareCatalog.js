const LOCATION_ID = 'LY3JYWKY4FHHQ';
const HEADERS = {
    'Square-Version': '2024-01-17',
    'Content-Type': 'application/json',
};

// ── Overtime Charge Service Configuration ─────────────────────────────────────
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
 * Format milliseconds to human-readable duration
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

/**
 * Search for an existing Square customer by phone number.
 */
export async function searchSquareCustomer(phone) {
    const searchRes = await fetch('/api/square/v2/customers/search', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
            query: { filter: { phone_number: { exact: phone } } }
        })
    });
    const searchData = await searchRes.json();
    return (searchData.customers && searchData.customers.length > 0) ? searchData.customers[0] : null;
}

/**
 * Find or create a Square customer by phone/name.
 */
export async function findOrCreateSquareCustomer({ phone, name, email = '' }) {
    const existing = await searchSquareCustomer(phone);
    const firstName = name.split(' ')[0];
    const lastName = name.split(' ').slice(1).join(' ');

    if (existing) {
        if (firstName && !existing.given_name) {
            await fetch(`/api/square/v2/customers/${existing.id}`, {
                method: 'PUT',
                headers: HEADERS,
                body: JSON.stringify({ given_name: firstName, family_name: lastName, email_address: email || existing.email_address }),
            });
        }
        return existing;
    }

    const createRes = await fetch('/api/square/v2/customers', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
            idempotency_key: `customer-phone-${phone.replace(/\D/g, '')}-${Date.now()}`,
            given_name: firstName,
            family_name: lastName,
            phone_number: phone,
            email_address: email
        })
    });
    const createData = await createRes.json();
    if (!createRes.ok || createData.errors) throw new Error(createData.errors?.[0]?.detail || `Customer error: ${createRes.status}`);
    return createData.customer;
}

/**
 * Get overtime variation for the given minutes.
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

// ── Catalog Cache ─────────────────────────────────────────────────────────────
let _servicesCache = null;
let _servicesCacheTime = 0;
const SERVICES_CACHE_TTL = 5 * 60 * 1000;

/**
 * Fetch catalog from Square with robust grouping & sorting logic.
 */
export async function fetchSquareServices() {
    if (_servicesCache && (Date.now() - _servicesCacheTime) < SERVICES_CACHE_TTL) return _servicesCache;

    try {
        const response = await fetch('/api/square/v2/catalog/list?types=ITEM,CATEGORY', { headers: HEADERS });
        if (!response.ok) {
            if (response.status === 429 && _servicesCache) return _servicesCache;
            throw new Error(`Square API error: ${response.status}`);
        }

        const data = await response.json();
        const objects = data.objects || [];
        const categories = {};
        const items = [];

        objects.forEach(obj => {
            if (obj.type === 'CATEGORY') {
                categories[obj.id] = {
                    name: obj.category_data?.name || 'Other',
                    ordinal: obj.category_data?.parent_category?.ordinal ?? obj.category_data?.ordinal ?? 0
                };
            } else if (obj.type === 'ITEM') {
                items.push(obj);
            }
        });

        const grouped = {};
        items.forEach(item => {
            const itemData = item.item_data || {};
            const categoryId = itemData.category_id || itemData.categories?.[0]?.id;
            const categoryInfo = (categoryId && categories[categoryId]) ? categories[categoryId] : { name: 'Other', ordinal: 999 };
            const categoryName = categoryInfo.name;

            if (!grouped[categoryName]) {
                grouped[categoryName] = { ordinal: categoryInfo.ordinal, services: {} };
            }

            const itemName = itemData.name || 'Service';
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

                const price = varData.price_money ? Math.round(varData.price_money.amount / 100) : 0;
                const duration = formatDuration(durationMs);
                const description = itemData.description || '';
                const isAddon = durationMs === 0 || 
                               description.includes('[ADD ON]') || 
                               categoryName.toLowerCase().includes('add') || 
                               categoryName.toLowerCase().includes('enhancement') || 
                               itemName.toLowerCase().includes('add-on');

                grouped[categoryName].services[itemName].description = description.replace(/\[ADD ON\]/gi, '').trim();
                grouped[categoryName].services[itemName].variations.push({
                    id: variation.id,
                    version: variation.version,
                    name: varData.name || 'Regular',
                    fullName: itemVariations.length === 1 ? itemName : `${itemName} (${varData.name})`,
                    baseServiceName: itemName,
                    duration,
                    durationMs,
                    price,
                    isBookable,
                    isAddon
                });
            });
        });

        const result = Object.entries(grouped)
            .map(([category, data]) => {
                const servicesList = Object.values(data.services)
                    .filter(s => s.variations.length > 0)
                    .map(s => ({ ...s, variations: s.variations.sort((a, b) => a.durationMs - b.durationMs) }));
                return { category, services: servicesList, ordinal: data.ordinal };
            })
            .filter(cat => cat.services.length > 0)
            .sort((a, b) => a.ordinal - b.ordinal)
            .map(({ category, services }) => ({ category, items: services }));

        _servicesCache = result;
        _servicesCacheTime = Date.now();
        return result;
    } catch (e) { console.error(e); return _servicesCache || []; }
}

/**
 * Fetch team members.
 */
export async function fetchSquareTeamMembers() {
    try {
        const response = await fetch(`/api/square/v2/bookings/team-member-booking-profiles?location_id=${LOCATION_ID}`, { headers: HEADERS });
        if (response.ok) {
            const data = await response.json();
            const profiles = data.team_member_booking_profiles || [];
            if (profiles.length > 0) {
                return profiles.filter(p => p.is_bookable).map(p => ({ id: p.team_member_id, name: p.display_name || 'Professional', image: null }));
            }
        }
        return [];
    } catch { return []; }
}

/**
 * Fetch location details.
 */
export async function fetchSquareLocation() {
    try {
        const response = await fetch(`/api/square/v2/locations/${LOCATION_ID}`, { headers: HEADERS });
        if (!response.ok) return null;
        const data = await response.json();
        const loc = data.location;
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayMap = { 'SUN': 'Sunday', 'MON': 'Monday', 'TUE': 'Tuesday', 'WED': 'Wednesday', 'THU': 'Thursday', 'FRI': 'Friday', 'SAT': 'Saturday' };
        
        const openingHours = (loc.business_hours?.periods || []).map(p => {
            const formatTime = (t) => {
                if (!t) return '';
                const [h, m] = t.split(':').map(Number);
                const ampm = h >= 12 ? 'pm' : 'am';
                const h12 = h % 12 || 12;
                return `${h12}:${String(m).padStart(2, '0')}${ampm}`;
            };
            return { day: dayMap[p.day_of_week] || 'Unknown', hours: `${formatTime(p.start_local_time)} - ${formatTime(p.end_local_time)}` };
        });

        const fullHours = days.map(day => openingHours.find(h => h.day === day) || { day, hours: 'Closed' });
        return { name: loc.name, address: `${loc.address?.address_line_1}, ${loc.address?.locality}`, openingHours: fullHours };
    } catch { return null; }
}

/**
 * Create bookings with Rollback logic and Turnstile verification.
 */
export async function createSquareBookings(guests, ignoredId, guestInfo, turnstileToken) {
    const customer = await findOrCreateSquareCustomer(guestInfo);
    
    const bookingPromises = guests.map(async (guest) => {
        if (!guest.services?.length || !guest.time) return null;
        const bookableServices = guest.services.filter(s => s.durationMs > 0);
        if (bookableServices.length === 0) return { guest: guest.name, skipped: true };

        const { date, time, availability } = guest.time;
        const [hours, minutes] = time.split(':').map(Number);
        const pad = n => String(n).padStart(2, '0');
        const dObj = new Date(date.date);
        const startAt = `${date.year}-${pad(dObj.getMonth() + 1)}-${pad(date.dayNum)}T${pad(hours)}:${pad(minutes)}:00+11:00`;

        const segments = bookableServices.map(service => {
            const teamMemberId = (guest.staff && guest.staff.id !== 'any') ? guest.staff.id : availability?.appointment_segments?.[0]?.team_member_id;
            return {
                service_variation_id: service.id,
                service_variation_version: service.version,
                duration_minutes: Math.round(service.durationMs / 60000),
                ...(teamMemberId ? { team_member_id: teamMemberId } : {})
            };
        });

        // Add Overtime / Addons
        guest.services.filter(s => s.isAddon && (s.isOvertime || s.durationMs === 0)).forEach(addon => {
            segments.push({
                service_variation_id: addon.id,
                service_variation_version: addon.version,
                duration_minutes: addon.overtimeMins || 0,
                team_member_id: segments[0].team_member_id
            });
        });

        try {
            const resp = await fetch('/api/square/v2/bookings', {
                method: 'POST',
                headers: { ...HEADERS, 'X-Turnstile-Token': turnstileToken },
                body: JSON.stringify({
                    idempotency_key: `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    booking: { location_id: LOCATION_ID, start_at: startAt, appointment_segments: segments, customer_id: customer.id }
                }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.errors?.[0]?.detail || 'Booking failed');
            return { guest: guest.name, booking: data.booking };
        } catch (err) {
            return { guest: guest.name, error: err.message };
        }
    });

    const results = (await Promise.all(bookingPromises)).filter(Boolean);
    const hasError = results.some(r => r.error);

    // Rollback logic
    if (hasError) {
        const successes = results.filter(r => !r.error && !r.skipped && r.booking?.id);
        const cancelPromises = successes.map(async (r) => {
            await fetch(`/api/square/v2/bookings/${r.booking.id}/cancel`, {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({ idempotency_key: `c-${Date.now()}` })
            }).catch(() => null);
            r.error = 'Booking rollbacked';
        });
        await Promise.all(cancelPromises);
    }

    return results;
}
