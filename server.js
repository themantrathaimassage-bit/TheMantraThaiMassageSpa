import express from 'express';
import cors from 'cors';
import compression from 'compression';
import NodeCache from 'node-cache';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import 'dotenv/config';
import fetch from 'node-fetch';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// ─── Performance & Security ──────────────────────────────────────────────────
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes cache
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Static files with Cache-Control for assets
const ONE_YEAR = 31536000;
app.use(express.static(path.join(__dirname, 'dist'), {
    maxAge: ONE_YEAR * 1000,
    immutable: true,
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        }
    }
}));

// ─── Firebase Setup ─────────────────────────────────────────────────────────
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        const projectId = serviceAccount.project_id;
        const dbUrl = process.env.FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`;

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: dbUrl
            });
        }
        console.log(`✅ Firebase initialized: ${projectId}`);
    } catch (err) {
        console.error('❌ Firebase init failed:', err.message);
    }
}

const db = admin.apps.length ? admin.database() : null;
const TOKEN_PATH = 'square/token';

// ─── State Management ────────────────────────────────────────────────────────
let tokenData = null;
let isSyncing = false;

async function loadToken() {
    if (!db) return null;
    try {
        const snapshot = await db.ref(TOKEN_PATH).once('value');
        return snapshot.val();
    } catch (err) {
        return null;
    }
}

loadToken().then(data => { tokenData = data; });

// ─── Square OAuth & Sync ─────────────────────────────────────────────────────
const GOOGLE_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
const PLACE_ID = 'ChIJUYEDwxGxEmsRziWxb3tic7k';

async function syncReviews() {
    if (!GOOGLE_API_KEY || isSyncing) return;
    isSyncing = true;
    console.log('🔄 Syncing Google Reviews...');

    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=reviews,rating,user_ratings_total&reviews_sort=newest&key=${GOOGLE_API_KEY}`;
        const resp = await fetch(url);
        const data = await resp.json();

        if (data.status !== 'OK') throw new Error(data.error_message || data.status);

        let existing = [];
        if (db) {
            const snap = await db.ref('square/googleReviewsData/reviews').once('value');
            if (snap.exists()) existing = snap.val() || [];
        }

        const nowSec = Math.floor(Date.now() / 1000);
        const fetched = (data.result.reviews || []).map(r => {
            const diffHours = Math.floor((nowSec - r.time) / 3600);
            const diffDays = Math.floor(diffHours / 24);
            let dateStr = r.relative_time_description;

            if (diffHours < 24) {
                dateStr = diffHours === 0 ? "Just now" : `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            } else if (diffDays < 7) {
                dateStr = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            }

            return {
                id: `google-${r.time}-${r.author_name}`,
                user: r.author_name,
                avatar: r.profile_photo_url || null,
                authorUrl: r.author_url || null,
                rating: r.rating,
                date: dateStr,
                comment: r.text,
                rawTime: r.time || 0
            };
        }).filter(r => r.comment.length > 5);

        const map = new Map();
        existing.forEach(r => { if (r.user) map.set(r.user.toLowerCase().trim(), r); });
        fetched.forEach(r => { if (r.user) map.set(r.user.toLowerCase().trim(), r); });

        const final = Array.from(map.values())
            .sort((a, b) => (b.rawTime || 0) - (a.rawTime || 0))
            .slice(0, 50);

        if (final.length > 0 && db) {
            await db.ref('square/reviews').set(final);
            await db.ref('square/googleReviewsData').set({
                reviews: final,
                rating: data.result.rating || 5.0,
                user_ratings_total: data.result.user_ratings_total || 0,
            });
            cache.del('api_reviews'); // Invalidate cache
        }
    } catch (err) {
        console.error('❌ Sync failed:', err.message);
    } finally {
        isSyncing = false;
    }
}

// Background Tasks
setInterval(syncReviews, 15 * 60 * 1000); // 15 mins
setTimeout(syncReviews, 5000);

// ─── Square Proxy logic ──────────────────────────────────────────────────────
const SQUARE_ENV = process.env.SQUARE_ENV || 'production';
const SQUARE_BASE_URL = SQUARE_ENV === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';

async function refreshSquareToken() {
    if (!tokenData?.refresh_token) return false;
    const expiresAt = new Date(tokenData.expires_at);
    if ((expiresAt - new Date()) / (1000 * 60 * 60 * 24) > 7) return true;

    try {
        const resp = await fetch(`${SQUARE_BASE_URL}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Square-Version': '2024-01-17' },
            body: JSON.stringify({
                client_id: process.env.SQUARE_APP_ID,
                client_secret: process.env.SQUARE_APP_SECRET,
                grant_type: 'refresh_token',
                refresh_token: tokenData.refresh_token,
            }),
        });
        const data = await resp.json();
        if (resp.ok && data.access_token) {
            tokenData = { ...tokenData, ...data, obtained_at: new Date().toISOString() };
            if (db) await db.ref(TOKEN_PATH).set(tokenData);
            return true;
        }
    } catch (err) {
        console.error('Token refresh err:', err.message);
    }
    return false;
}

// ─── API Routes ─────────────────────────────────────────────────────────────
app.get('/api/reviews', async (req, res) => {
    const cached = cache.get('api_reviews');
    if (cached) return res.json(cached);

    try {
        if (db) {
            const snap = await db.ref('square/googleReviewsData').once('value');
            if (snap.exists()) {
                const data = snap.val();
                cache.set('api_reviews', data, 1800); // Cache for 30 mins
                return res.json(data);
            }
        }
        res.status(404).json({ error: 'No reviews found' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.all(/\/api\/square\/(.*)/, async (req, res) => {
    const squarePath = req.path.replace('/api/square', '');
    const cacheKey = `sq:${req.method}:${squarePath}:${JSON.stringify(req.body)}`;

    if (req.method === 'GET' && cache.has(cacheKey)) return res.json(cache.get(cacheKey));

    try {
        await refreshSquareToken();
        const auth = tokenData?.access_token || process.env.SQUARE_ACCESS_TOKEN;
        const target = `${SQUARE_BASE_URL}${squarePath}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

        const sqRes = await fetch(target, {
            method: req.method,
            headers: {
                'Authorization': `Bearer ${auth}`,
                'Square-Version': '2024-01-17',
                'Content-Type': 'application/json'
            },
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body)
        });

        const data = await sqRes.json();
        if (sqRes.ok && req.method === 'GET') cache.set(cacheKey, data, 300); // 5 min cache for reads
        res.status(sqRes.status).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/sync-reviews', (req, res) => {
    syncReviews();
    res.json({ status: 'triggered' });
});

// SPA Fallback
app.get('/:path*', (req, res) => {
    const indexFile = path.join(__dirname, 'dist', 'index.html');
    if (existsSync(indexFile)) return res.sendFile(indexFile);
    res.status(404).send('Not built yet');
});

app.listen(PORT, () => console.log(`🚀 Production-ready server on ${PORT}`));
