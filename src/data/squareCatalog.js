const LOCATION_ID = 'LY3JYWKY4FHHQ';
const HEADERS = {
    'Square-Version': '2024-01-17',
    'Content-Type': 'application/json',
};

export async function searchSquareCustomer(phone) {
    const res = await fetch('/api/square/v2/customers/search', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ query: { filter: { phone_number: { exact: phone } } } })
    });
    const data = await res.json();
    return (data.customers && data.customers.length > 0) ? data.customers[0] : null;
}

export async function findOrCreateSquareCustomer({ phone, name, email = '' }) {
    const existing = await searchSquareCustomer(phone);
    if (existing) {
        if ((name && !existing.given_name) || (email && !existing.email_address)) {
            await fetch(`/api/square/v2/customers/${existing.id}`, {
                method: 'PUT',
                headers: HEADERS,
                body: JSON.stringify({ 
                    given_name: name.split(' ')[0], 
                    family_name: name.split(' ').slice(1).join(' '),
                    email_address: email || existing.email_address
                }),
            });
        }
        return existing;
    }
    const res = await fetch('/api/square/v2/customers', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
            idempotency_key: `c-${phone.replace(/\D/g, '')}-${Date.now()}`,
            given_name: name.split(' ')[0],
            family_name: name.split(' ').slice(1).join(' '),
            phone_number: phone,
            email_address: email
        })
    });
    const data = await res.json();
    if (!res.ok || data.errors) throw new Error(data.errors?.[0]?.detail || 'Customer Error');
    return data.customer;
}

export function getOvertimeVariation(amount, overtimeMins = 0) {
    if (!overtimeMins || overtimeMins <= 0) return null;
    const OVERTIME_VARIATIONS = {
        15: { id: '4MS5UIXPM5J7PTIEDUJPWFHY', price: 5 },
        30: { id: 'HFQBUIH7RBVGF4R6UCDLUB6Y', price: 10 },
        45: { id: 'YASVDMSWCNMIPXDYTXUMXMYF', price: 15 },
        60: { id: 'FLU2L6LRG53FNFGNTH3NL6B5', price: 20 },
        75: { id: '2W4RDPZCPMNCAP236H5BP4VW', price: 25 },
        90: { id: 'AGZRQAC5J5SPU6ZMU5PEDV6H', price: 30 },
        105: { id: 'VQRJJJ4ZVYT7VEG6CAR2P4NP', price: 35 },
        120: { id: '5HADX7QYPN2MV2Q43V5E7MXK', price: 40 },
    };
    const bracket = Math.ceil(overtimeMins / 15) * 15;
    const capped = Math.min(bracket, 120);
    const variation = OVERTIME_VARIATIONS[capped];
    if (!variation) return null;
    return {
        id: variation.id,
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

export async function fetchSquareServices() {
    try {
        const response = await fetch('/api/square/v2/catalog/list?types=ITEM,CATEGORY', { headers: HEADERS });
        const data = await response.json();
        const objects = data.objects || [];
        const categories = {};
        const items = [];

        objects.forEach(obj => {
            if (obj.type === 'CATEGORY') categories[obj.id] = { name: obj.category_data?.name || 'Other', ordinal: obj.category_data?.ordinal || 0 };
            else if (obj.type === 'ITEM') items.push(obj);
        });

        const grouped = {};
        items.forEach(item => {
            const itemData = item.item_data || {};
            const categoryRef = itemData.categories?.[0];
            const categoryInfo = (categoryRef && categories[categoryRef.id]) ? categories[categoryRef.id] : { name: 'Other', ordinal: 999 };
            const categoryName = categoryInfo.name;

            if (!grouped[categoryName]) grouped[categoryName] = { ordinal: categoryInfo.ordinal, services: {} };

            const itemName = itemData.name || 'Service';
            const description = (itemData.description || '').replace(/\[ADD ON\]/gi, '').trim();

            if (!grouped[categoryName].services[itemName]) {
                grouped[categoryName].services[itemName] = { name: itemName, description, variations: [] };
            }

            const itemVariations = itemData.variations || [];
            itemVariations.forEach(variation => {
                const varData = variation.item_variation_data || {};
                const durationMs = varData.service_duration || 0;
                if (!varData.available_for_booking && durationMs > 0) return;

                const price = Math.round((varData.price_money?.amount || 0) / 100);
                const isAddon = durationMs === 0 || categoryName.toLowerCase().includes('add') || itemName.toLowerCase().includes('add-on') || (itemData.description || '').includes('[ADD ON]');

                grouped[categoryName].services[itemName].variations.push({
                    id: variation.id,
                    version: variation.version,
                    name: varData.name || 'Regular',
                    fullName: itemVariations.length === 1 ? itemName : `${itemName} (${varData.name})`,
                    baseServiceName: itemName,
                    duration: durationMs > 0 ? `${Math.round(durationMs/60000)}min` : 'Add-on',
                    durationMs,
                    price,
                    isAddon
                });
            });
        });

        return Object.entries(grouped)
            .map(([category, data]) => ({ 
                category, 
                items: Object.values(data.services).filter(s => s.variations.length > 0), 
                ordinal: data.ordinal 
            }))
            .sort((a, b) => a.ordinal - b.ordinal);
    } catch (e) { console.error(e); return []; }
}

export async function fetchSquareTeamMembers() {
    try {
        const response = await fetch(`/api/square/v2/bookings/team-member-booking-profiles?location_id=${LOCATION_ID}`, { headers: HEADERS });
        const data = await response.json();
        return (data.team_member_booking_profiles || []).filter(p => p.is_bookable).map(p => ({
            id: p.team_member_id, name: p.display_name || 'Professional', image: null
        }));
    } catch (e) { return []; }
}

export async function fetchSquareLocation() {
    try {
        const res = await fetch(`/api/square/v2/locations/${LOCATION_ID}`, { headers: HEADERS });
        const data = await res.json();
        if (!res.ok || !data.location) return null;
        const loc = data.location;
        const days = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
        const periods = loc.business_hours?.periods || [];
        const oh = periods.map(p => ({
            day: days[p.day_of_week === 'SUN' ? 0 : days.indexOf(p.day_of_week)],
            start: p.start_local_time,
            end: p.end_local_time
        }));
        return { name: loc.name, address: `${loc.address?.address_line_1}, ${loc.address?.locality}`, openingHours: oh };
    } catch { return null; }
}

export async function createSquareBookings(guests, ignoredId, guestInfo, turnstileToken) {
    const customer = await findOrCreateSquareCustomer(guestInfo);
    const bookingPromises = guests.map(async (guest) => {
        if (!guest.services?.length || !guest.time) return null;
        const bookableServices = guest.services.filter(s => s.durationMs > 0);
        if (bookableServices.length === 0) return null;

        const { date, time, availability } = guest.time;
        const [h, m] = time.split(':').map(Number);
        const startAt = `${date.year}-${String(new Date(date.date).getMonth()+1).padStart(2,'0')}-${String(date.dayNum).padStart(2,'0')}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00+11:00`;

        const segments = bookableServices.map(service => ({
            service_variation_id: service.id,
            service_variation_version: service.version,
            duration_minutes: Math.round(service.durationMs / 60000),
            team_member_id: (guest.staff && guest.staff.id !== 'any') ? guest.staff.id : availability?.appointment_segments?.[0]?.team_member_id
        }));

        guest.services.filter(s => s.isAddon && s.durationMs === 0).forEach(addon => {
            segments.push({ service_variation_id: addon.id, duration_minutes: 0, team_member_id: segments[0].team_member_id });
        });

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
    });

    const results = await Promise.all(bookingPromises);
    return results.filter(Boolean);
}
