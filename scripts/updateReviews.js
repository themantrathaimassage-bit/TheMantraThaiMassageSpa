import fs from 'fs';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_MAPS_URL = 'https://www.google.com/maps/place/The+Mantra+Thai+Massage+spa+Marrickville/@-33.9120463,151.1597879,17z/data=!3m1!4b1!4m6!3m5!1s0x6b12b111c3038151:0xb973627b6fb125ce!8m2!3d-33.9120463!4d151.1597879!16s%2Fg%2F11ynwshjt4';

async function fetchReviews() {
    console.log('🚀 Starting Google Reviews scraper (Flexible Mode)...');

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,1024'
        ]
    });

    const page = await browser.newPage();

    try {
        await page.setViewport({ width: 1280, height: 1024 });
        await page.goto(GOOGLE_MAPS_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for page load
        await new Promise(r => setTimeout(r, 5000));

        // Find and click ANY element that looks like reviews or rating
        console.log('🖱 Searching for clickable reviews element...');
        await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('button, span, div.F7nice'));
            const targets = elements.filter(el =>
                el.innerText.includes('รีวิว') ||
                el.innerText.includes('Review') ||
                el.getAttribute('aria-label')?.includes('รีวิว') ||
                el.getAttribute('aria-label')?.includes('Review')
            );

            if (targets.length > 0) {
                // Pick the most likely one (usually the one with a number or stars)
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
        console.log('📊 Extracting...');
        const reviews = await page.evaluate(() => {
            const items = document.querySelectorAll('.jftiEf');
            if (items.length === 0) return [];

            return Array.from(items).map((el, index) => {
                const user = el.querySelector('.d4r55')?.innerText || 'Anonymous';
                const ratingEl = el.querySelector('.kvMYyc');
                const ratingAttr = ratingEl ? ratingEl.getAttribute('aria-label') : '5';
                const rating = parseInt(ratingAttr.match(/\d+/)?.[0] || '5');
                const date = el.querySelector('.rsqawe')?.innerText || '';

                // Try to find original text
                // In some versions, original text is in a sibling or nested div after clicking
                const commentEl = el.querySelector('.wiI79');
                let comment = commentEl ? commentEl.innerText : '';

                // Cleanup
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
            const outputPath = path.resolve(__dirname, '../src/data/reviewsData.js');
            const fileContent = `export const reviewsData = ${JSON.stringify(reviews, null, 4)};\n`;
            fs.writeFileSync(outputPath, fileContent);
            console.log(`✅ Success! Updated ${reviews.length} reviews.`);
        } else {
            console.log('⚠️ No reviews found. Check output manually.');
            await page.screenshot({ path: 'scraper-final-debug.png' });
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await browser.close();
    }
}

fetchReviews();
