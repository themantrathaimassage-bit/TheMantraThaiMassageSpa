export async function onRequest() {
    return new Response(JSON.stringify({ status: 'ok', environment: 'cloudflare-pages' }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
