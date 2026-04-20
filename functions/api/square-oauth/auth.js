export async function onRequest(context) {
    const { request, env } = context;
    
    const scope = [
        'MERCHANT_PROFILE_READ',
        'PAYMENTS_WRITE',
        'CUSTOMERS_READ',
        'CUSTOMERS_WRITE',
        'APPOINTMENTS_READ',
        'APPOINTMENTS_WRITE',
        'APPOINTMENTS_BUSINESS_SETTINGS_READ',
        'INVENTORY_READ',
        'ITEMS_READ',
        'EMPLOYEES_READ'
    ].join(' ');

    const SQUARE_ENV = env.SQUARE_ENV || 'production';
    const SQUARE_BASE_URL = SQUARE_ENV === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
    
    const url = `${SQUARE_BASE_URL}/oauth2/authorize?client_id=${env.SQUARE_APP_ID}&scope=${encodeURIComponent(scope)}&session=false&state=cf-auth&redirect_uri=${encodeURIComponent(env.SQUARE_REDIRECT_URI)}`;
    
    return Response.redirect(url, 302);
}
