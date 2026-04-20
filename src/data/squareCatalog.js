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
 */
export async function findOrCreateSquareCustomer({ phone, name = '' }) {
    const existing = await searchSquareCustomer(phone);
    if (existing) return existing;

    const [firstName, ...lastNameParts] = name.split(' ');
    const lastName = lastNameParts.join(' ');

    const createRes = await fetch('/api/square/v2/customers', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
            idempotency_key: `cust-${phone.replace(/\D/g, '')}-${Date.now()}`,
            given_name: firstName || 'Guest',
            family_name: lastName || '',
            phone_number: phone,
        })
    });
    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(createData.errors?.[0]?.detail || 'Failed to create customer');
    return createData.customer;
}

// Overtime Charge Service (from Square catalog "over time charge")
const OVERTIME_VARIATIONS = {
    15: { id: '4MS5UIXPM5J7PTIEDUJPWFHY', version: 1772196501587, price: 5 },
    30: { id: 'HFQBUIH7RBVGF4R6UCDLUB6Y', version: 1772196501587, price: 10 },
    45: { id: 'YASVDMSWCNMIPXDYTXUMXMYF', version: 1772196501587, price: 15 },
    60: { id: 'FLU2L6LRG53FNFGNTH3NL6B5', version: 1772196501587, price: 20 },
    75: { id: '2W4RDPZCPMNCAP236H5BP4VW', version: 1772196501587, price: 25 },
    90: { id: 'AGZRQAC5J5SPU6ZMU5PEDV6H', version: 1772196501587, price: 30 },
    105: { id: 'VQRJJJ4ZVYT7VEG6CAR2P4NP', version: 1772196501587, price: 35 },
    120: { id: '5HADX7QYPN2MV2Q43V5E7MXK', version: 1772196501587, price: 40 },
};

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

let _servicesCache = null;
let _servicesCacheTime = 0;
const SERVICES_CACHE_TTL = 5 * 60 * 1000;

export async function fetchSquareServices() {
    if (_servicesCache && (Date.now() - _servicesCacheTime) < SERVICES_CACHE_TTL) return _servicesCache;
    try {
        const response = await fetch('/api/square/v2/catalog/list?types=ITEM,CATEGORY', { headers: HEADERS });
        if (!response.ok) return _servicesCache || null;
        const data = await response.json();
        const objects = data.objects || [];
        const categories = {};
        const items = [];
        objects.forEach(obj => {
            if (obj.type === 'CATEGORY') {
                categories[obj.id] = { name: obj.category_data?.name || 'Other', ordinal: obj.category_data?.parent_category?.ordinal ?? 0 };
            } else if (obj.type === 'ITEM') { items.push(obj); }
        });
        const grouped = {};
        items.forEach(item => {
            const itemData = item.item_data || {};
            const categoryRef = (itemData.categories && itemData.categories.length > 0) ? itemData.categories[0] : null;
            const categoryInfo = categoryRef && categories[categoryRef.id] ? categories[categoryRef.id] : { name: itemData.name || 'Other', ordinal: 0 };
            if (!grouped[categoryInfo.name]) grouped[categoryInfo.name] = { ordinal: categoryInfo.ordinal, services: {} };
            const itemName = itemData.name || 'Unnamed Service';
            if (!grouped[categoryInfo.name].services[itemName]) {
                grouped[categoryInfo.name].services[itemName] = { name: itemName, description: (itemData.description || '').replace(/\[ADD ON\]/gi, '').trim(), variations: [] };
            }
            const itemVariations = itemData.variations || [];
            itemVariations.forEach(variation => {
                const varData = variation.item_variation_data || {};
                const durationMs = varData.service_duration || 0;
                if (!varData.available_for_booking && durationMs > 0) return;
                const price = Math.round((varData.price_money?.amount || 0) / 100);
                const isAddon = durationMs === 0 || (itemData.description || '').includes('[ADD ON]') || categoryInfo.name.toLowerCase().includes('add');
                grouped[categoryInfo.name].services[itemName].isAddon = isAddon;
                grouped[categoryInfo.name].services[itemName].variations.push({ id: variation.id, version: variation.version, name: varData.name || 'Regular', fullName: itemVariations.length === 1 ? itemName : `${itemName} (${varData.name})`, duration: formatDuration(durationMs), durationMs, price, isBookable: true });
            });
        });
        const result = Object.entries(grouped).map(([category, data]) => ({ category, items: Object.values(data.services).filter(s => s.variations.length > 0).map(s => ({ ...s, variations: s.variations.sort((a,b) => a.durationMs - b.durationMs) })), ordinal: data.ordinal })).filter(c => c.items.length > 0).sort((a,b) => a.ordinal - b.ordinal);
        _servicesCache = result; _servicesCacheTime = Date.now();
        return result;
    } catch (e) { return _servicesCache || null; }
}

export async function fetchSquareTeamMembers() {
    try {
        const response = await fetch(`/api/square/v2/bookings/team-member-booking-profiles?location_id=${LOCATION_ID}`, { headers: HEADERS });
        if (response.ok) {
            const data = await response.json();
            return (data.team_member_booking_profiles || []).filter(p => p.is_bookable).map(p => ({ id: p.team_member_id, name: p.display_name || 'Professional', image: null }));
        }
        return [];
    } catch (e) { return []; }
}

export async function fetchSquareLocation() {
    try {
        const response = await fetch(`/api/square/v2/locations/${LOCATION_ID}`, { headers: HEADERS });
        if (!response.ok) return null;
        const data = await response.json();
        const loc = data.location;
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayMap = { 'SUN': 'Sunday', 'MON': 'Monday', 'TUE': 'Tuesday', 'WED': 'Wednesday', 'THU': 'Thursday', 'FRI': 'Friday', 'SAT': 'Saturday' };
        const openingHours = (loc.business_hours?.periods || []).map(p => {
            const fmt = (t) => { if (!t) return '??:??'; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`; };
            return { day: dayMap[p.day_of_week], hours: `${fmt(p.start_local_time)} - ${fmt(p.end_local_time)}` };
        });
        return { name: loc.name, address: `${loc.address?.address_line_1}, ${loc.address?.locality}`, openingHours: days.map(d => openingHours.find(h => h.day === d) || { day: d, hours: 'Closed' }) };
    } catch (e) { return null; }
}

export async function createSquareBookings(guests, ignoredId, guestInfo, turnstileToken) {
    // 1. Ensure customer exists
    const customer = await findOrCreateSquareCustomer({ phone: guestInfo.phone, name: guestInfo.name });
    
    // 2. Map guests to booking promises
    const bookingPromises = guests.map(async (guest) => {
        if (!guest.services?.length || !guest.time) return null;
        const bookables = guest.services.filter(s => s.durationMs > 0);
        const { date, time } = guest.time;
        const [h, m] = time.split(':').map(Number);
        const pad = n => String(n).padStart(2, '0');
        const startAt = `${date.year}-${pad(new Date(date.date).getMonth() + 1)}-${pad(date.dayNum)}T${pad(h)}:${pad(m)}:00+11:00`;

        const segments = bookables.map(s => ({
            service_variation_id: s.id,
            service_variation_version: s.version,
            duration_minutes: Math.round(s.durationMs / 60000),
            team_member_id: (guest.staff && guest.staff.id !== 'any') ? guest.staff.id : undefined
        }));

        // OT and Addons
        const ot = guest.services.find(s => s.isOvertime);
        if (ot) segments.push({ service_variation_id: ot.id, service_variation_version: ot.version, duration_minutes: ot.overtimeMins });
        guest.services.filter(s => s.isAddon && !s.isOvertime && s.durationMs === 0).forEach(a => segments.push({ service_variation_id: a.id, service_variation_version: a.version, duration_minutes: 0 }));

        try {
            const resp = await fetch('/api/square/v2/bookings', {
                method: 'POST',
                headers: { ...HEADERS, 'X-Turnstile-Token': turnstileToken },
                body: JSON.stringify({
                    idempotency_key: `bk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    booking: { location_id: LOCATION_ID, start_at: startAt, appointment_segments: segments, customer_id: customer.id, customer_note: guestInfo.email ? `Email: ${guestInfo.email}` : '' }
                }),
            });
            const d = await resp.json();
            if (!resp.ok) throw new Error(d.errors?.[0]?.detail || 'Booking failed');
            return { guest: guest.name, booking: d.booking };
        } catch (err) { return { guest: guest.name, error: err.message }; }
    });

    const results = await Promise.all(bookingPromises);
    const valid = results.filter(Boolean);
    if (valid.some(r => r.error)) {
        await Promise.all(valid.filter(r => !r.error && r.booking?.id).map(r => fetch(`/api/square/v2/bookings/${r.booking.id}/cancel`, { method: 'POST', headers: HEADERS, body: JSON.stringify({ idempotency_key: `c-${Date.now()}` }) })));
    }
    return valid;
}

function formatDuration(ms) {
    if (!ms) return 'Add-on';
    const mins = Math.round(ms / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h === 0 ? `${m}min` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}
