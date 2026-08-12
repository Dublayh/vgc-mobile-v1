// Share-link smoke: Team editor → Share link → open the URL in a fresh page →
// preview renders → save → team appears in editor with a new id.
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 414, height: 1000 },
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto('http://localhost:5173/?seed#teams/demo-team', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Share link', exact: true }).click();
await page.waitForTimeout(500);
const url = await page.evaluate(() => navigator.clipboard.readText());
const validUrl = url?.includes('#share/');

// Open the link in a brand-new page (fresh store), like a recipient would.
const page2 = await context.newPage();
page2.on('pageerror', (e) => errors.push(e.message));
await page2.goto(url, { waitUntil: 'networkidle' });
const previewVisible = (await page2.getByText('Shared team').count()) > 0;
const monCount = await page2.getByText(/GARCHOMP-MEGA|TYRANITAR|EXCADRILL|WHIMSICOTT/i).count();
await page2.screenshot({ path: process.argv[2] ?? 'share.png', fullPage: true });

await page2.getByRole('button', { name: 'Save to my teams' }).click();
await page2.waitForTimeout(500);
const savedInEditor = (await page2.locator('input[value="Sand core"]').count()) > 0;

console.log('share url valid:', validUrl, '| preview:', previewVisible, 'mons:', monCount, '| saved:', savedInEditor);
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(errors.length || !validUrl || !previewVisible || monCount < 4 || !savedInEditor ? 1 : 0);
