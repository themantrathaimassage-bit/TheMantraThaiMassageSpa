export async function onRequest(context) {
    const { env } = context;
    
    // 1. Check cache in Firebase (REST)
    try {
        if (env.FIREBASE_DATABASE_URL && env.FIREBASE_SECRET) {
            const dbUrl = `${env.FIREBASE_DATABASE_URL}/square/googleReviewsData.json?auth=${env.FIREBASE_SECRET}`;
            const res = await fetch(dbUrl);
            if (res.ok) {
                const data = await res.json();
                if (data) {
                    return new Response(JSON.stringify(data), {
                        headers: { 
                            'Content-Type': 'application/json',
                            'Cache-Control': 'public, max-age=1800' // 30 mins browser cache
                        }
                    });
                }
            }
        }
    } catch (err) {
        console.error('Reviews storage error:', err);
    }

    // 2. Fetch from Google if not in storage (Fallback)
    const GOOGLE_API_KEY = env.GOOGLE_MAPS_API_KEY;
    const PLACE_ID = 'ChIJUYEDwxGxEmsRziWxb3tic7k';

    if (!GOOGLE_API_KEY) {
        return new Response(JSON.stringify({ error: 'Missing API Key' }), { status: 500 });
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=reviews,rating,user_ratings_total&reviews_sort=newest&key=${GOOGLE_API_KEY}`;
        const resp = await fetch(url);
        const data = await resp.json();

        if (data.status !== 'OK') throw new Error(data.error_message || data.status);

        // Transform (Same logic as server.js)
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
        };

        return new Response(JSON.stringify(reviewsDataObj), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
