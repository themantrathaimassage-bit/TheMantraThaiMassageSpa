export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    // Extract Path
    const squarePath = url.pathname.replace('/api/square', '');
    const query = url.search;
    
    const SQUARE_ENV = env.SQUARE_ENV || 'production';
    const SQUARE_BASE_URL = SQUARE_ENV === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
    
    // 1. Get Token from KV (Cloudflare Storage)
    let tokenData = null;
    let accessToken = env.SQUARE_ACCESS_TOKEN; // Fallback to env var
    
    try {
        if (env.BOOKING_KV) {
            const rawToken = await env.BOOKING_KV.get('square_token');
            if (rawToken) {
                tokenData = JSON.parse(rawToken);
                accessToken = tokenData.access_token;
            }
        }
    } catch (err) {
        console.error('KV Storage Error:', err);
    }

    if (!accessToken) {
        return new Response(JSON.stringify({ 
            error: "No Square Token found", 
            hint: "Please connect Square via /api/square-oauth/auth or set SQUARE_ACCESS_TOKEN" 
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    // 2. Proxy request to Square
    const targetUrl = `${SQUARE_BASE_URL}${squarePath}${query}`;
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('Square-Version', '2024-01-17');
    headers.set('Content-Type', 'application/json');

    // Clean up internal Cloudflare headers
    headers.delete('Host');
    headers.delete('cf-connecting-ip');
    headers.delete('cf-ray');
    headers.delete('cf-visitor');

    try {
        const body = ['GET', 'HEAD'].includes(request.method) ? null : await request.text();
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
                'Access-Control-Allow-Origin': '*',
                'X-Source': 'Cloudflare-KV-Proxy'
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: "Square API Error", details: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
