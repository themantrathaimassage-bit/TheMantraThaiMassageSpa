export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    // Extract the Square path (everything after /api/square)
    const squarePath = url.pathname.replace('/api/square', '');
    const query = url.search;
    
    const SQUARE_ENV = env.SQUARE_ENV || 'production';
    const SQUARE_BASE_URL = SQUARE_ENV === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
    
    // 1. Get Token (We'll use a direct REST call to Firebase to keep it simple and fast in Workers)
    let accessToken = env.SQUARE_ACCESS_TOKEN; // Fallback to env variable
    
    try {
        // Try to fetch the latest token from Firebase Realtime Database using REST
        // Note: You need to set FIREBASE_DATABASE_URL and FIREBASE_SECRET in Cloudflare env
        if (env.FIREBASE_DATABASE_URL && env.FIREBASE_SECRET) {
            const dbUrl = `${env.FIREBASE_DATABASE_URL}/square/token.json?auth=${env.FIREBASE_SECRET}`;
            const tokenRes = await fetch(dbUrl);
            if (tokenRes.ok) {
                const tokenData = await tokenRes.json();
                if (tokenData && tokenData.access_token) {
                    accessToken = tokenData.access_token;
                }
            }
        }
    } catch (err) {
        console.error('Firebase token fetch error:', err);
    }

    const targetUrl = `${SQUARE_BASE_URL}${squarePath}${query}`;
    
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('Square-Version', '2024-01-17');
    headers.set('Content-Type', 'application/json');

    const body = ['GET', 'HEAD'].includes(request.method) ? null : await request.text();

    try {
        const sqRes = await fetch(targetUrl, {
            method: request.method,
            headers: headers,
            body: body
        });

        const data = await sqRes.json();
        return new Response(JSON.stringify(data), {
            status: sqRes.status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
