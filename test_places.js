import fetch from 'node-fetch';
import 'dotenv/config';

const GOOGLE_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
const PLACE_ID = 'ChIJUVidmLOpEmsRXiXxb3tifbk'; // The Mantra Marrickville Place ID

async function testApi() {
    console.log('Testing Google Places API for Marrickville...');
    console.log('Using Key:', GOOGLE_API_KEY ? GOOGLE_API_KEY.substring(0, 8) + '...' : 'MISSING');

    if (!GOOGLE_API_KEY) {
        console.error('Error: API Key is missing from .env');
        return;
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=name,reviews,rating&key=${GOOGLE_API_KEY}`;
        const resp = await fetch(url);
        const data = await resp.json();

        if (data.status !== 'OK') {
            console.log('❌ API Error Status:', data.status);
            console.log('❌ Message:', data.error_message || 'No specific error message');
            if (data.status === 'REQUEST_DENIED') {
                console.log('\n💡 Tip: Make sure "Places API" is ENABLED in Google Cloud Console.');
                console.log('Link: https://console.cloud.google.com/marketplace/product/google/places-backend.googleapis.com');
            }
            return;
        }

        console.log('✅ Success! Found Business:', data.result.name);
        console.log('⭐ Rating:', data.result.rating);
        console.log('💬 Latest Reviews:');

        data.result.reviews?.forEach((r, i) => {
            console.log(`\n[${i + 1}] ${r.author_name} (${r.rating} stars)`);
            console.log(`"${r.text.substring(0, 100)}${r.text.length > 100 ? '...' : ''}"`);
        });
    } catch (err) {
        console.error('❌ Connection Error:', err.message);
    }
}

testApi();
