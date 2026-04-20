export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    const squarePath = url.pathname.replace('/api/square', '');
    const query = url.search;
    
    // Normalize Firebase URL: ensure no trailing slash
    let fbBaseUrl = env.FIREBASE_DATABASE_URL || "";
    if (fbBaseUrl.endsWith('/')) fbBaseUrl = fbBaseUrl.slice(0, -1);
    
    const SQUARE_ENV = env.SQUARE_ENV || 'production';
    const SQUARE_BASE_URL = SQUARE_ENV === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
    
    let accessToken = env.SQUARE_ACCESS_TOKEN;
    let debugInfo = "";

    try {
        if (fbBaseUrl && env.FIREBASE_SECRET) {
            const dbUrl = `${fbBaseUrl}/square/token.json?auth=${env.FIREBASE_SECRET}`;
            const tokenRes = await fetch(dbUrl);
            if (tokenRes.ok) {
                const tokenData = await tokenRes.json();
                if (tokenData && tokenData.access_token) {
                    accessToken = tokenData.access_token;
                } else if (tokenData === null) {
                    debugInfo = `Firebase data at /square/token is empty (null). Check your Firebase path.`;
                } else {
                    debugInfo = `Firebase response found but 'access_token' field missing. Keys found: ${Object.keys(tokenData).join(', ')}`;
                }
            } else {
                debugInfo = `Firebase error: Status ${tokenRes.status}. Check your FIREBASE_SECRET.`;
            }
        } else {
            debugInfo = `Env variables missing. URL: ${fbBaseUrl ? 'OK' : 'MISSING'}, SECRET: ${env.FIREBASE_SECRET ? 'OK' : 'MISSING'}`;
        }
    } catch (err) {
        debugInfo = `Catch Error: ${err.message}`;
    }

    if (!accessToken) {
        return new Response(JSON.stringify({ 
            error: "Authentication failed", 
            debug: debugInfo,
            config_check: {
                has_fb_url: !!fbBaseUrl,
                has_fb_secret: !!env.FIREBASE_SECRET,
                has_static_token: !!env.SQUARE_ACCESS_TOKEN
            }
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    const targetUrl = `${SQUARE_BASE_URL}${squarePath}${query}`;
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('Square-Version', '2024-01-17');
    headers.set('Content-Type', 'application/json');

    // Strip problematic headers
    headers.delete('Host');
    headers.delete('cf-connecting-ip');
    headers.delete('cf-ray');

    try {
        const bodyContent = ['GET', 'HEAD'].includes(request.method) ? null : await request.text();
        const sqRes = await fetch(targetUrl, {
            method: request.method,
            headers: headers,
            body: bodyContent
        });

        const data = await sqRes.json();
        return new Response(JSON.stringify(data), {
            status: sqRes.status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'X-Debug': 'Proxy-Active'
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: "Square API Error", info: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
