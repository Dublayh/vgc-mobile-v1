/**
 * Dev screenshot driver: drives system Edge headless against the dev server.
 *   node scripts/shoot.mjs <url> <outfile.png> [--full]
 * Prints page console errors/warnings so silent failures are visible.
 */
import { chromium } from 'playwright-core';

const [url, out, ...flags] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node scripts/shoot.mjs <url> <out.png> [--full]');
  process.exit(1);
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });

page.on('console', (msg) => {
  if (['error', 'warning'].includes(msg.type())) {
    console.log(`[console.${msg.type()}]`, msg.text());
  }
});
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: out, fullPage: flags.includes('--full') });
console.log('saved', out);
await browser.close();
