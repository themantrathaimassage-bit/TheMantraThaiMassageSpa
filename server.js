import express from 'express';
import cors from 'cors';
import compression from 'compression';
import NodeCache from 'node-cache';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import 'dotenv/config';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// ─── Performance Optimization ────────────────────────────────────────────────
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes default cache

app.use(compression()); // Compress all responses
app.use(cors());
app.use(express.json());

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.send('system active'));

// Serve static files (with safety check)
const distPath = path.join(__dirname, 'dist');
if (existsSync(distPath)) {
    app.use(express.static(distPath));
} else {
    console.log('⚠️ Warning: "dist" folder not found. Run "npm run build" first.');
}

// ─── Token Storage ────────────────────────────────────────────────────────────
const TOKEN_FILE = path.join(__dirname, '.square-token.json');

function loadToken() {
    if (existsSync(TOKEN_FILE)) {
        try { return JSON.parse(readFileSync(TOKEN_FILE, 'utf-8')); } catch { }
    }
    return null;
}

function saveToken(data) {
    writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
}

let tokenData = loadToken();

// ─── Square Config ────────────────────────────────────────────────────────────
const SQUARE_APP_ID = process.env.SQUARE_APP_ID;
const SQUARE_APP_SECRET = process.env.SQUARE_APP_SECRET;
const SQUARE_ENV = process.env.SQUARE_ENV || 'production';
const SQUARE_BASE_URL = SQUARE_ENV === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';
const REDIRECT_URI = process.env.SQUARE_REDIRECT_URI || 'http://localhost:3001/api/square-oauth/callback';

// ─── Token Refresh Utility ───────────────────────────────────────────────────
async function refreshTokenIfNeeded() {
    if (!tokenData?.refresh_token) return false;
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const daysUntilExpiry = (expiresAt - now) / (1000 * 60 * 60 * 24);

    if (daysUntilExpiry > 7) return true;

    try {
        const resp = await fetch(`${SQUARE_BASE_URL}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Square-Version': '2024-01-17' },
            body: JSON.stringify({
                client_id: SQUARE_APP_ID,
                client_secret: SQUARE_APP_SECRET,
                grant_type: 'refresh_token',
                refresh_token: tokenData.refresh_token,
            }),
        });
        const data = await resp.json();
        if (resp.ok && data.access_token) {
            tokenData = { ...tokenData, ...data, obtained_at: new Date().toISOString() };
            saveToken(tokenData);
            return true;
        }
    } catch (err) {
        console.error('Token refresh failed:', err.message);
    }
    return false;
}

// ─── OAuth Endpoints ─────────────────────────────────────────────────────────
app.get('/api/square-oauth/url', (req, res) => {
    if (!SQUARE_APP_ID) return res.status(500).json({ error: 'SQUARE_APP_ID not set' });
    const scope = 'APPOINTMENTS_WRITE APPOINTMENTS_READ APPOINTMENTS_ALL_READ ITEMS_READ CUSTOMERS_READ CUSTOMERS_WRITE';
    const state = Math.random().toString(36).slice(2);
    const url = `${SQUARE_BASE_URL}/oauth2/authorize?client_id=${SQUARE_APP_ID}&scope=${encodeURIComponent(scope)}&state=${state}&session=false&response_type=code`;
    res.json({ url });
});

app.get('/api/square-oauth/callback', async (req, res) => {
    const { code, error } = req.query;
    if (error || !code) return res.send(`<h2>❌ Error: ${error || 'no code'}</h2>`);
    try {
        const resp = await fetch(`${SQUARE_BASE_URL}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Square-Version': '2024-01-17' },
            body: JSON.stringify({
                client_id: SQUARE_APP_ID,
                client_secret: SQUARE_APP_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT_URI,
            }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error('Token exchange failed');
        tokenData = { ...data, obtained_at: new Date().toISOString() };
        saveToken(tokenData);
        res.send('<html><body style="text-align:center;padding:40px"><h2>Authorized! You can close this window.</h2></body></html>');
    } catch (err) {
        res.status(500).send(`Error: ${err.message}`);
    }
});

// ─── Optimized Square Proxy with Caching ─────────────────────────────────────
app.all(/\/api\/square\/(.*)/, async (req, res) => {
    const squarePath = req.path.replace('/api/square', '');
    const cacheKey = `${req.method}:${squarePath}:${JSON.stringify(req.body)}`;

    // 1. Check Cache (Only for read-only items like Catalog and Team)
    if (req.method === 'GET' || (req.method === 'POST' && (squarePath.includes('catalog/list') || squarePath.includes('team-members/search')))) {
        const cachedResponse = cache.get(cacheKey);
        if (cachedResponse) return res.json(cachedResponse);
    }

    // 2. Auth Preparation
    await refreshTokenIfNeeded();
    const authToken = tokenData?.access_token || process.env.SQUARE_ACCESS_TOKEN;
    if (!authToken) return res.status(500).json({ error: 'No token' });

    const targetUrl = `${SQUARE_BASE_URL}${squarePath}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

    try {
        const fetchOptions = {
            method: req.method,
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Square-Version': '2024-01-17',
                'Content-Type': 'application/json',
            }
        };
        if (!['GET', 'HEAD'].includes(req.method)) fetchOptions.body = JSON.stringify(req.body);

        const squareRes = await fetch(targetUrl, fetchOptions);
        const data = await squareRes.json();

        // 3. Cache the result if it's a successful catalog or team lookup
        if (squareRes.ok && (req.method === 'GET' || (req.method === 'POST' && (squarePath.includes('catalog') || squarePath.includes('team-members'))))) {
            cache.set(cacheKey, data);
        }

        res.status(squareRes.status).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SPA Routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Optimized server live on port ${PORT}`));
