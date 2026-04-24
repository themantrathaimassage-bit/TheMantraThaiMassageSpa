import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const HEADERS = {
    'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
    'Square-Version': '2024-01-17',
    'Content-Type': 'application/json',
};

async function snapshotServices() {
    console.log('🔄 Fetching services from Square for snapshot...');
    try {
        const response = await fetch('https://connect.squareup.com/v2/catalog/list?types=ITEM,CATEGORY', { headers: HEADERS });
        if (!response.ok) throw new Error(`Square API error: ${response.status}`);

        const data = await response.json();
        const objects = data.objects || [];
        const categories = {};
        const items = [];

        objects.forEach(obj => {
            if (obj.type === 'CATEGORY') {
                categories[obj.id] = { 
                    name: obj.category_data?.name || 'Other', 
                    ordinal: obj.category_data?.parent_category?.ordinal ?? 0 
                };
            } else if (obj.type === 'ITEM') {
                items.push(obj);
            }
        });

        const grouped = {};
        items.forEach(item => {
            const itemData = item.item_data || {};
            const categoryRef = (itemData.categories && itemData.categories.length > 0) ? itemData.categories[0] : null;
            const categoryInfo = categoryRef && categories[categoryRef.id] ? categories[categoryRef.id] : { name: itemData.name || 'Other', ordinal: 0 };
            
            if (!grouped[categoryInfo.name]) {
                grouped[categoryInfo.name] = { ordinal: categoryInfo.ordinal, services: {} };
            }

            const itemName = itemData.name || 'Unnamed Service';
            if (!grouped[categoryInfo.name].services[itemName]) {
                grouped[categoryInfo.name].services[itemName] = {
                    name: itemName,
                    description: (itemData.description || '').replace(/\[ADD ON\]/gi, '').trim(),
                    variations: []
                };
            }

            const itemVariations = itemData.variations || [];
            itemVariations.forEach(variation => {
                const varData = variation.item_variation_data || {};
                const durationMs = varData.service_duration || 0;
                if (!varData.available_for_booking && durationMs > 0) return;
                
                const price = Math.round((varData.price_money?.amount || 0) / 100);
                const isAddon = durationMs === 0 || (itemData.description || '').includes('[ADD ON]') || categoryInfo.name.toLowerCase().includes('add');
                
                grouped[categoryInfo.name].services[itemName].isAddon = isAddon;
                grouped[categoryInfo.name].services[itemName].variations.push({
                    id: variation.id,
                    version: variation.version,
                    name: varData.name || 'Regular',
                    fullName: itemVariations.length === 1 ? itemName : `${itemName} (${varData.name})`,
                    duration: formatDuration(durationMs),
                    durationMs,
                    price,
                    isBookable: true
                });
            });
        });

        const result = Object.entries(grouped)
            .map(([category, data]) => ({
                category,
                items: Object.values(data.services)
                    .filter(s => s.variations.length > 0)
                    .map(s => ({ ...s, variations: s.variations.sort((a,b) => a.durationMs - b.durationMs) })),
                ordinal: data.ordinal
            }))
            .filter(c => c.items.length > 0)
            .sort((a,b) => a.ordinal - b.ordinal);

        const content = `// Auto-generated snapshot of Square Services
export const servicesData = ${JSON.stringify(result, null, 2)};
`;

        fs.writeFileSync('src/data/servicesData.js', content);
        console.log('✅ Snapshot saved to src/data/servicesData.js');
    } catch (e) {
        console.error('❌ Failed to create snapshot:', e.message);
    }
}

function formatDuration(ms) {
    if (!ms) return 'Add-on';
    const mins = Math.round(ms / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h === 0 ? `${m}min` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

snapshotServices();
