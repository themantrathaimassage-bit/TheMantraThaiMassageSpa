export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    
    if (!code) return new Response('No code provided', { status: 400 });

    const SQUARE_ENV = env.SQUARE_ENV || 'production';
    const SQUARE_BASE_URL = SQUARE_ENV === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
    
    try {
        const resp = await fetch(`${SQUARE_BASE_URL}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Square-Version': '2024-01-17' },
            body: JSON.stringify({
                client_id: env.SQUARE_APP_ID,
                client_secret: env.SQUARE_APP_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: env.SQUARE_REDIRECT_URI
            }),
        });

        const data = await resp.json();
        if (resp.ok && data.access_token) {
            const tokenData = { ...data, obtained_at: new Date().toISOString() };
            
            // SAVE TO KV
            if (env.BOOKING_KV) {
                await env.BOOKING_KV.put('square_token', JSON.stringify(tokenData));
            }

            return new Response('<h1>✅ Cloudflare Connected to Square!</h1><p>You can close this window now.</p>', {
                headers: { 'Content-Type': 'text/html' }
            });
        } else {
            return new Response(JSON.stringify(data), { status: 500 });
        }
    } catch (err) {
        return new Response(err.message, { status: 500 });
    }
}
