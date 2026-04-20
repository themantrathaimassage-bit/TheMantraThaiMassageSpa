export async function onRequest(context) {
    const { env } = context;
    const GOOGLE_API_KEY = env.GOOGLE_MAPS_API_KEY;
    const PLACE_ID = 'ChIJUYEDwxGxEmsRziWxb3tic7k';

    // 1. Check if we have reviews in KV (Cloudflare Storage)
    if (env.BOOKING_KV) {
        try {
            const cached = await env.BOOKING_KV.get('google_reviews');
            if (cached) {
                const reviewsData = JSON.parse(cached);
                // If data is less than 24 hours old, return it
                if (reviewsData.lastUpdated && (Date.now() - reviewsData.lastUpdated < 86400000)) {
                    return new Response(cached, {
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                    });
                }
            }
        } catch (err) {
            console.error('KV Read Error:', err);
        }
    }

    // 2. Fetch fresh reviews from Google if no cache or expired
    if (!GOOGLE_API_KEY) {
        return new Response(JSON.stringify({ error: 'Missing Google API Key' }), { 
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*' }
        });
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=reviews,rating,user_ratings_total&reviews_sort=newest&key=${GOOGLE_API_KEY}&language=en`;
        const resp = await fetch(url);
        const data = await resp.json();

        if (data.status !== 'OK') throw new Error(data.error_message || data.status);

        const reviews = (data.result.reviews || []).map(r => ({
            id: `google-${r.time}-${r.author_name}`,
            user: r.author_name,
            avatar: r.profile_photo_url || null,
            rating: r.rating,
            date: r.relative_time_description,
            comment: r.text,
            rawTime: r.time || 0
        })).filter(r => r.comment.length > 5);

        const reviewsDataObj = {
            reviews: reviews,
            rating: data.result.rating || 5.0,
            user_ratings_total: data.result.user_ratings_total || 0,
            lastUpdated: Date.now()
        };

        const jsonResponse = JSON.stringify(reviewsDataObj);

        // 3. Save to KV for next time (Caching)
        if (env.BOOKING_KV) {
            await env.BOOKING_KV.put('google_reviews', jsonResponse);
        }

        return new Response(jsonResponse, {
            headers: { 
                'Content-Type': 'application/json', 
                'Access-Control-Allow-Origin': '*',
                'X-Source': 'Google-Live'
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*' }
        });
    }
}
