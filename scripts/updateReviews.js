import fs from 'fs';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin if not already initialized
if (process.env.FIREBASE_SERVICE_ACCOUNT && !admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        const projectId = serviceAccount.project_id;
        const dbUrl = process.env.FIREBASE_DATABASE_URL ||
            `https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`;

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: dbUrl
        });
    } catch (err) {
        console.error('❌ Firebase Admin init failed in scraper:', err.message);
    }
}

const db = admin.apps.length ? admin.database() : null;
const REVIEWS_PATH = 'square/reviews';
const GOOGLE_MAPS_URL = 'https://www.google.com/maps/place/The+Mantra+Thai+Massage+spa+Marrickville/@-33.9120463,151.1597879,17z/data=!3m1!4b1!4m6!3m5!1s0x6b12b111c3038151:0xb973627b6fb125ce!8m2!3d-33.9120463!4d151.1597879!16s%2Fg%2F11ynwshjt4';

async function fetchReviews() {
    console.log('🚀 Starting Google Reviews scraper...');

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1280,1024'
        ]
    });

    const page = await browser.newPage();

    try {
        await page.setViewport({ width: 1280, height: 1024 });
        await page.goto(GOOGLE_MAPS_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for page load
        await new Promise(r => setTimeout(r, 5000));

        // Find and click reviews element
        console.log('🖱 Searching for reviews element...');
        await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('button, span, div.F7nice'));
            const targets = elements.filter(el =>
                el.innerText.includes('รีวิว') ||
                el.innerText.includes('Review') ||
                el.getAttribute('aria-label')?.includes('รีวิว') ||
                el.getAttribute('aria-label')?.includes('Review')
            );

            if (targets.length > 0) {
                const best = targets.find(t => t.innerText.match(/\d+/)) || targets[0];
                best.click();
                return "Clicked: " + best.innerText;
            }
            return "No target found";
        });

        await new Promise(r => setTimeout(r, 5000));

        // Expand all reviews
        console.log('🔍 Expanding reviews...');
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            buttons.forEach(b => {
                const txt = b.innerText.toLowerCase();
                if (txt.includes('more') || txt.includes('เพิ่มเติม') ||
                    txt.includes('see original') || txt.includes('ดูฉบับต้นฉบับ') ||
                    txt.includes('original') || txt.includes('ต้นฉบับ')) {
                    b.click();
                }
            });
        });

        await new Promise(r => setTimeout(r, 2000));

        // Extract reviews
        console.log('📊 Extracting reviews...');
        const reviews = await page.evaluate(() => {
            const items = document.querySelectorAll('.jftiEf');
            if (items.length === 0) return [];

            return Array.from(items).map((el, index) => {
                const user = el.querySelector('.d4r55')?.innerText || 'Anonymous';
                const ratingEl = el.querySelector('.kvMYyc');
                const ratingAttr = ratingEl ? ratingEl.getAttribute('aria-label') : '5';
                const rating = parseInt(ratingAttr.match(/\d+/)?.[0] || '5');
                const date = el.querySelector('.rsqawe')?.innerText || '';
                const commentEl = el.querySelector('.wiI79');
                let comment = commentEl ? commentEl.innerText : '';

                comment = comment.replace(/\(Translated by Google\)/g, '')
                    .replace(/\(ต้นฉบับ\)/g, '')
                    .replace(/\(Original\)/g, '')
                    .trim();

                return {
                    id: `google-${index}`,
                    user,
                    rating,
                    date,
                    comment
                };
            }).filter(r => r.comment.length > 0).slice(0, 20);
        });

        if (reviews.length > 0) {
            if (db) {
                await db.ref(REVIEWS_PATH).set(reviews);
                console.log(`✅ Success! Updated ${reviews.length} reviews in Firebase.`);
            } else {
                const outputPath = path.resolve(__dirname, '../src/data/reviewsData.js');
                const fileContent = `export const reviewsData = ${JSON.stringify(reviews, null, 4)};\n`;
                fs.writeFileSync(outputPath, fileContent);
                console.log(`✅ Local fallback: Updated ${reviews.length} reviews.`);
            }
        } else {
            console.log('⚠️ No reviews found.');
            await page.screenshot({ path: 'scraper-debug.png' });
        }

    } catch (error) {
        console.error('❌ Scraper Error:', error);
    } finally {
        await browser.close();
        if (admin.apps.length) await admin.app().delete();
    }
}

fetchReviews();
