import express from 'express';
import cors from 'cors';
import compression from 'compression';
import NodeCache from 'node-cache';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import 'dotenv/config';
import fetch from 'node-fetch';
import admin from 'firebase-admin';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security & Performance ──────────────────────────────────────────────────
// 1. Helmet sets secure HTTP headers (including CSP)
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://challenges.cloudflare.com", "https://maps.googleapis.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https://*.googleusercontent.com", "https://*.squareup.com", "https://maps.gstatic.com"],
            connectSrc: ["'self'", "https://challenges.cloudflare.com", "https://maps.googleapis.com", "https://cloudflareworkers.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            frameSrc: ["'self'", "https://challenges.cloudflare.com", "https://www.google.com", "https://maps.google.com"],
        },
    },
}));

// 2. Rate Limiting to prevent brute-force attacks
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);

const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes cache
app.use(compression());

// 3. Restricted CORS (Update this with your actual production domain)
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl) 
        // OR requests from allowed domains
        const isAllowed = !origin ||
            origin.startsWith('http://localhost') ||
            origin.startsWith('http://127.0.0.1') ||
            origin.startsWith('http://192.168.') ||
            origin === 'https://mantra-thai-massage.onrender.com';

        if (isAllowed) {
            callback(null, true);
        } else {
            console.error('Blocked by CORS:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

app.use(express.json({ limit: '500kb' }));

// Simple logger for API calls
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.ip}`);
    }
    next();
});

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
try {
    let serviceAccount = null;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
        const localPath = path.join(__dirname, 'firebase-service-account.json');
        if (existsSync(localPath)) {
            serviceAccount = JSON.parse(readFileSync(localPath, 'utf8'));
        }
    }

    if (serviceAccount) {
        const projectId = serviceAccount.project_id;
        const dbUrl = process.env.FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`;

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: dbUrl
            });
        }
        console.log(`✅ Firebase initialized: ${projectId}`);
    } else {
        console.log('⚠️ Firebase initialized skipped: No service account provided');
    }
} catch (err) {
    console.error('❌ Firebase init failed:', err.message);
}

const db = admin.apps.length ? admin.database() : null;
const TOKEN_PATH = 'square/token';

// ─── State Management ────────────────────────────────────────────────────────
let tokenData = null;
let isSyncing = false;

async function loadToken() {
    let data = null;
    if (db) {
        try {
            const snapshot = await db.ref(TOKEN_PATH).once('value');
            data = snapshot.val();
        } catch (err) { }
    }

    if (!data) {
        try {
            const fs = await import('fs');
            const localFile = path.join(__dirname, '.square-token.json');
            if (fs.existsSync(localFile)) {
                data = JSON.parse(fs.readFileSync(localFile, 'utf8'));
            }
        } catch (err) { }
    }
    return data;
}

loadToken().then(data => {
    tokenData = data;
    if (tokenData) console.log('✅ Square Token loaded');
});

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
        } else {
            try {
                const fs = await import('fs');
                const localFile = path.join(__dirname, '.reviews.json');
                if (fs.existsSync(localFile)) {
                    existing = JSON.parse(fs.readFileSync(localFile, 'utf8')).reviews || [];
                }
            } catch (ignore) { }
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

        if (final.length > 0) {
            const reviewsDataObj = {
                reviews: final,
                rating: data.result.rating || 5.0,
                user_ratings_total: data.result.user_ratings_total || 0,
            };

            if (db) {
                await db.ref('square/reviews').set(final);
                await db.ref('square/googleReviewsData').set(reviewsDataObj);
            } else {
                try {
                    const fs = await import('fs');
                    fs.writeFileSync(path.join(__dirname, '.reviews.json'), JSON.stringify(reviewsDataObj, null, 2));
                } catch (ignore) { }
            }
            cache.set('api_reviews', reviewsDataObj, 1800); // 30 mins
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
app.get('/api/square-oauth/auth', (req, res) => {
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

    const redirectUri = process.env.SQUARE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/square-oauth/callback`;
    const url = `${SQUARE_BASE_URL}/oauth2/authorize?client_id=${process.env.SQUARE_APP_ID}&scope=${encodeURIComponent(scope)}&session=false&state=82910&redirect_uri=${encodeURIComponent(redirectUri)}`;
    res.redirect(url);
});

app.get('/api/square-oauth/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('No code provided');

    try {
        const resp = await fetch(`${SQUARE_BASE_URL}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Square-Version': '2024-01-17' },
            body: JSON.stringify({
                client_id: process.env.SQUARE_APP_ID,
                client_secret: process.env.SQUARE_APP_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: process.env.SQUARE_REDIRECT_URI
            }),
        });

        const data = await resp.json();
        if (resp.ok && data.access_token) {
            tokenData = { ...data, obtained_at: new Date().toISOString() };
            if (db) await db.ref(TOKEN_PATH).set(tokenData);
            // Also save to a local file as backup
            import('fs').then(fs => {
                fs.writeFileSync(path.join(__dirname, '.square-token.json'), JSON.stringify(tokenData, null, 2));
            });
            res.send('<h1>✅ Square Connected!</h1><p>You can close this window and go back to the app.</p>');
        } else {
            res.status(500).json(data);
        }
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/square-oauth/test', async (req, res) => {
    if (!tokenData) return res.json({ status: 'offline', advice: 'Visit /api/square-oauth/auth' });
    const expiresAt = new Date(tokenData.expires_at);
    const daysLeft = Math.round((expiresAt - new Date()) / (1000 * 60 * 60 * 24));
    res.json({
        status: 'online',
        expires: tokenData.expires_at,
        daysLeft,
        env: SQUARE_ENV
    });
});

app.get('/api/reviews', async (req, res) => {
    const cached = cache.get('api_reviews');
    if (cached) return res.json(cached);

    try {
        if (db) {
            const snap = await db.ref('square/googleReviewsData').once('value');
            if (snap.exists()) {
                const data = snap.val();
                cache.set('api_reviews', data, 1800);
                return res.json(data);
            }
        } else {
            const fs = await import('fs');
            const localFile = path.join(__dirname, '.reviews.json');
            if (fs.existsSync(localFile)) {
                const data = JSON.parse(fs.readFileSync(localFile, 'utf8'));
                cache.set('api_reviews', data, 1800);
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

// ─── Turnstile Verification ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// SPA Fallback
app.get(/^\/(?!api).*/, (req, res) => {
    const indexFile = path.join(__dirname, 'dist', 'index.html');
    if (existsSync(indexFile)) return res.sendFile(indexFile);
    res.status(404).send('Not built yet');
});

app.listen(PORT, () => console.log(`🚀 Production-ready server on ${PORT}`));
