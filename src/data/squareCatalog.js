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
export async function fetchSquareServices() {
    try {
        const response = await fetch('/api/square/v2/catalog/list?types=ITEM,CATEGORY', {
            headers: HEADERS,
        });

        if (!response.ok) {
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

                const isAddon = durationMs === 0 ||
                    categoryName.toLowerCase().includes('add') ||
                    categoryName.toLowerCase().includes('enhancement') ||
                    itemData.name?.toLowerCase().includes('add-on') ||
                    itemData.name?.toLowerCase().includes('addon') ||
                    itemData.name?.toLowerCase().includes('add on');

                grouped[categoryName].services[itemName].isAddon = isAddon;
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
            .sort((a, b) => b.ordinal - a.ordinal)
            .map(({ category, services }) => ({ category, items: services })); // name "items" kept for backward compat maybe, but it's now services


        return result;

    } catch (error) {
        console.error('Failed to fetch Square catalog:', error);
        return null;
    }
}

/**
 * Fetch all active team members from Square.
 */
export async function fetchSquareTeamMembers() {
    try {
        const response = await fetch('/api/square/v2/team-members/search', {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                query: {
                    filter: {
                        status: 'ACTIVE',
                        location_ids: [LOCATION_ID]
                    }
                }
            })
        });

        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        return data.team_members || [];
    } catch (error) {
        console.error('Failed to fetch team members:', error);
        return [];
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

        const segments = guest.services.map(service => {
            const availSeg = (availability?.appointment_segments || []).find(s => s.service_variation_id === service.id) || (availability?.appointment_segments || [])[0];
            const teamMemberId = (guest.staff && guest.staff.id !== 'any') ? guest.staff.id : availSeg?.team_member_id;

            return {
                service_variation_id: service.id,
                service_variation_version: service.version,
                duration_minutes: Math.round(service.durationMs / 60000),
                team_member_id: teamMemberId
            };
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
                let msg = err?.detail || 'Booking failed';

                // Friendly mapping for race conditions
                if (msg.includes('time slot is no longer available')) {
                    msg = 'Sorry, this time slot was just taken. Please select another time.';
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
    return results.filter(Boolean);
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
