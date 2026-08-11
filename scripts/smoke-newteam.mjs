// Repro of the reported bug: new team → empty slot → pick species.
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
});

await page.goto('http://localhost:5173/#teams', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /new team/i }).first().click();
await page.getByRole('button', { name: /slot 1/i }).click();
await page.getByPlaceholder('Search…').fill('garch');
await page.getByRole('button', { name: /garchomp/i }).first().click();
await page.waitForTimeout(400);

// We should now be in the filled SetEditor: forme row + SP allocator visible.
const formeVisible = await page.getByText('Stat points', { exact: false }).isVisible();
await page.screenshot({ path: process.argv[2] ?? 'flow.png', fullPage: true });

console.log('SetEditor rendered after species pick:', formeVisible);
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(errors.length || !formeVisible ? 1 : 0);
