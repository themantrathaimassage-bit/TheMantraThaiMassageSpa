const LOCATION_ID = 'LY3JYWKY4FHHQ';
const HEADERS = { 'Square-Version': '2024-01-17', 'Content-Type': 'application/json' };

export async function searchSquareCustomer(phone) {
    const res = await fetch('/api/square/v2/customers/search', { method: 'POST', headers: HEADERS, body: JSON.stringify({ query: { filter: { phone_number: { exact: phone } } } }) });
    const data = await res.json();
    return (data.customers && data.customers.length > 0) ? data.customers[0] : null;
}

export async function findOrCreateSquareCustomer({ phone, name, email = '' }) {
    const existing = await searchSquareCustomer(phone);
    if (existing) {
        if ((name && !existing.given_name) || (email && !existing.email_address)) {
            await fetch(`/api/square/v2/customers/${existing.id}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify({ given_name: name.split(' ')[0], family_name: name.split(' ').slice(1).join(' '), email_address: email || existing.email_address }) });
        }
        return existing;
    }
    const res = await fetch('/api/square/v2/customers', { method: 'POST', headers: HEADERS, body: JSON.stringify({ idempotency_key: `c-${phone.replace(/\D/g, '')}-${Date.now()}`, given_name: name.split(' ')[0], family_name: name.split(' ').slice(1).join(' '), phone_number: phone, email_address: email }) });
    const data = await res.json();
    if (!res.ok || data.errors) throw new Error(data.errors?.[0]?.detail || 'Customer Error');
    return data.customer;
}

export function getOvertimeVariation(amount, otMins = 0) {
    if (!otMins || otMins <= 0) return null;
    const VARS = { 15:{id:'4MS5UIXPM5J7PTIEDUJPWFHY',p:5}, 30:{id:'HFQBUIH7RBVGF4R6UCDLUB6Y',p:10}, 45:{id:'YASVDMSWCNMIPXDYTXUMXMYF',p:15}, 60:{id:'FLU2L6LRG53FNFGNTH3NL6B5',p:20}, 75:{id:'2W4RDPZCPMNCAP236H5BP4VW',p:25}, 90:{id:'AGZRQAC5J5SPU6ZMU5PEDV6H',p:30}, 105:{id:'VQRJJJ4ZVYT7VEG6CAR2P4NP',p:35}, 120:{id:'5HADX7QYPN2MV2Q43V5E7MXK',p:40} };
    const v = VARS[Math.min(Math.ceil(otMins/15)*15, 120)];
    return v ? { id:v.id, name:`Over Time Charge`, price:v.p, duration:`${otMins} min`, durationMs:0, isAddon:true, isOvertime:true } : null;
}

export async function fetchSquareServices() {
    try {
        const res = await fetch('/api/square/v2/catalog/list?types=ITEM,CATEGORY', { headers: HEADERS });
        const data = await res.json();
        const cats = {}; const items = [];
        (data.objects || []).forEach(o => { if (o.type === 'CATEGORY') cats[o.id] = { n: o.category_data?.name, o: o.category_data?.ordinal || 0 }; else if (o.type === 'ITEM') items.push(o); });
        const gp = {};
        items.forEach(it => {
            const c = (it.item_data?.categories?.[0]) ? cats[it.item_data.categories[0].id] : { n:'Other', o:0 };
            if (!gp[c.n]) gp[c.n] = { o:c.o, s:{} };
            const n = it.item_data.name; if (!gp[c.n].s[n]) gp[c.n].s[n] = { name:n, v:[] };
            (it.item_data.variations || []).forEach(v => {
                const d = v.item_variation_data?.service_duration || 0;
                if (!v.item_variation_data?.available_for_booking && d > 0) return;
                gp[c.n].s[n].v.push({ id:v.id, version:v.version, name:v.item_variation_data.name, duration:d>0?`${Math.round(d/60000)}min`:'Add-on', durationMs:d, price:Math.round((v.item_variation_data.price_money?.amount||0)/100), isAddon:d===0||c.n.toLowerCase().includes('add') });
            });
        });
        return Object.entries(gp).map(([k,v]) => ({ category:k, items:Object.values(v.s).filter(s=>s.v.length>0), ordinal:v.o })).sort((a,b)=>a.ordinal-b.ordinal);
    } catch { return []; }
}

export async function fetchSquareTeamMembers() {
    try {
        const res = await fetch(`/api/square/v2/bookings/team-member-booking-profiles?location_id=${LOCATION_ID}`, { headers: HEADERS });
        const data = await res.json();
        return (data.team_member_booking_profiles || []).filter(p=>p.is_bookable).map(p=>({ id:p.team_member_id, name:p.display_name, image:null }));
    } catch { return []; }
}

export async function fetchSquareLocation() {
    try {
        const res = await fetch(`/api/square/v2/locations/${LOCATION_ID}`, { headers: HEADERS });
        const data = await res.json();
        if (!res.ok || !data.location) return null;
        const loc = data.location;
        const days = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
        const oh = (loc.business_hours?.periods || []).map(p => ({ day: days[p.day_of_week === 'SUN' ? 0 : days.indexOf(p.day_of_week)], start: p.start_local_time, end: p.end_local_time }));
        return { name: loc.name, address: `${loc.address?.address_line_1}, ${loc.address?.locality}`, openingHours: oh };
    } catch { return null; }
}

export async function createSquareBookings(guests, ignoredId, guestInfo, turnstileToken) {
    const cus = await findOrCreateSquareCustomer(guestInfo);
    const promises = guests.map(async (g) => {
        if (!g.services?.length || !g.time) return null;
        const svs = g.services.filter(s => s.durationMs > 0); if (!svs.length) return null;
        const { date, time, availability } = g.time; const [h,m] = time.split(':').map(Number);
        const start = `${date.year}-${String(new Date(date.date).getMonth()+1).padStart(2,'0')}-${String(date.dayNum).padStart(2,'0')}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00+11:00`;
        const segs = svs.map(s => ({ service_variation_id:s.id, service_variation_version:s.version, duration_minutes:Math.round(s.durationMs/60000), team_member_id:(g.staff&&g.staff.id!=='any')?g.staff.id:availability?.appointment_segments?.[0]?.team_member_id }));
        g.services.filter(s => s.isAddon && s.durationMs === 0).forEach(a => segs.push({ service_variation_id:a.id, duration_minutes:0, team_member_id:segs[0].team_member_id }));
        const res = await fetch('/api/square/v2/bookings', { method:'POST', headers:{...HEADERS, 'X-Turnstile-Token':turnstileToken}, body:JSON.stringify({ idempotency_key:`b-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, booking:{ location_id:LOCATION_ID, start_at:start, appointment_segments:segs, customer_id:cus.id } }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.errors?.[0]?.detail || 'Booking Error');
        return { guest:g.name, booking:data.booking };
    });
    return (await Promise.all(promises)).filter(Boolean);
}
