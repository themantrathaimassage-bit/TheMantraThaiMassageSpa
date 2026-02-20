import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ACCESS_TOKEN = 'EAAAl9R3a2xUqGKVqDoIuwGrIlbhbSROF91NDP0IQ2sfHGdoz4CFEBZF1DhsyLcT';

async function syncStaff() {
    console.log('🚀 Syncing bookable staff members from Square...');

    try {
        const response = await fetch('https://connect.squareup.com/v2/bookings/team-member-booking-profiles', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Square-Version': '2024-01-17',
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.errors && data.errors.length > 0) {
            console.error('❌ Square API Error:', data.errors);
            return;
        }

        const profiles = data.team_member_booking_profiles || [];
        const bookableProfiles = profiles.filter(p => p.is_bookable === true);

        console.log(`📡 Found ${bookableProfiles.length} bookable team members in Square.`);

        const staffList = [
            {
                id: "any",
                name: "Any professional",
                image: null
            },
            ...bookableProfiles.map(profile => ({
                id: profile.team_member_id,
                name: profile.display_name.trim() || 'Professional',
                image: null
            }))
        ];

        const outputPath = path.resolve(__dirname, '../src/data/staffData.js');
        const fileContent = `export const staffData = ${JSON.stringify(staffList, null, 4)};\n`;

        fs.writeFileSync(outputPath, fileContent);
        console.log(`✅ Success! staffData.js has been updated with ${bookableProfiles.length} bookable professionals.`);

    } catch (error) {
        console.error('❌ Sync failed:', error);
    }
}

syncStaff();
