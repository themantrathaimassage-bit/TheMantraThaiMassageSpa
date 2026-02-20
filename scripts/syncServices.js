import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ACCESS_TOKEN = 'EAAAl9R3a2xUqGKVqDoIuwGrIlbhbSROF91NDP0IQ2sfHGdoz4CFEBZF1DhsyLcT';

function formatDuration(ms) {
    if (!ms) return 'Add-on';
    const totalMinutes = Math.round(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}min`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}

async function syncServices() {
    console.log('🚀 Syncing services with Grouped Hierarchy...');

    try {
        const response = await fetch('https://connect.squareup.com/v2/catalog/list?types=ITEM,CATEGORY', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Square-Version': '2024-01-17',
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.errors) {
            console.error('❌ Square Catalog Error:', data.errors);
            return;
        }

        const objects = data.objects || [];
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

        const grouped = {};

        items.forEach(item => {
            const itemData = item.item_data || {};
            if (itemData.product_type && itemData.product_type !== 'APPOINTMENTS_SERVICE') return;

            const categoryRef = (itemData.categories && itemData.categories.length > 0) ? itemData.categories[0] : null;
            const categoryInfo = categoryRef && categories[categoryRef.id] ? categories[categoryRef.id] : { name: itemData.name || 'Other', ordinal: 0 };
            const categoryName = categoryInfo.name;

            if (!grouped[categoryName]) {
                grouped[categoryName] = { ordinal: categoryInfo.ordinal, services: {} };
            }

            const itemName = itemData.name || 'Unnamed';
            if (!grouped[categoryName].services[itemName]) {
                grouped[categoryName].services[itemName] = {
                    name: itemName,
                    description: itemData.description || '',
                    variations: []
                };
            }

            const itemVariations = itemData.variations || [];
            itemVariations.forEach(v => {
                const varData = v.item_variation_data || {};
                const durationMs = varData.service_duration || 0;
                if (varData.available_for_booking === false && durationMs > 0) return;

                const price = (varData.price_money?.amount || 0) / 100;
                const duration = formatDuration(durationMs);

                const isAddon = durationMs === 0 ||
                    categoryName.toLowerCase().includes('add') ||
                    itemData.name?.toLowerCase().includes('add-on');

                grouped[categoryName].services[itemName].isAddon = isAddon;
                grouped[categoryName].services[itemName].variations.push({
                    id: v.id,
                    name: varData.name || 'Regular',
                    fullName: itemVariations.length === 1 ? itemName : `${itemName} (${varData.name})`,
                    duration,
                    durationMs,
                    price
                });
            });
        });

        const result = Object.entries(grouped)
            .map(([category, data]) => {
                const servicesList = Object.values(data.services)
                    .filter(s => s.variations.length > 0)
                    .map(s => ({
                        ...s,
                        variations: s.variations.sort((a, b) => a.durationMs - b.durationMs)
                    }));
                return { category, items: servicesList, ordinal: data.ordinal };
            })
            .filter(cat => cat.items.length > 0)
            .sort((a, b) => b.ordinal - a.ordinal)
            .map(({ category, items }) => ({ category, items }));

        const outputPath = path.resolve(__dirname, '../src/data/servicesData.js');
        fs.writeFileSync(outputPath, `export const servicesData = ${JSON.stringify(result, null, 4)};\n`);
        console.log(`✅ Success! Updated ${result.length} categories.`);

    } catch (error) {
        console.error('❌ Sync failed:', error);
    }
}

syncServices();
