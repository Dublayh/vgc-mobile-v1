// Multi-target sweep smoke: Tyranitar + Kingambit → who OHKOs BOTH; a cell
// tap loads the exact line into the Matchup calc.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 414, height: 1400 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
});

await page.goto('http://localhost:5173/?seed#calc', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'OHKO sweep', exact: true }).click();

const addTarget = async (name) => {
  await page.getByPlaceholder(/Add a target/).fill(name);
  await page.getByRole('button', { name: new RegExp(name, 'i') }).first().click();
  await page.waitForTimeout(200);
};
await addTarget('tyranitar');
await addTarget('kingambit');

await page.getByRole('button', { name: /Who OHKOs all 2/ }).click();
await page.waitForSelector('text=/\\d+ can/', { timeout: 120000 });
const canText = await page.getByText(/\d+ can/).first().textContent();
const rows = await page.locator('span.font-display.text-sm').allTextContents();
const topFive = rows.slice(0, 5);
await page.screenshot({ path: (process.argv[2] ?? 'ms') + '-list.png', fullPage: true });

// Tap the first Kingambit cell → matchup screen with that attacker loaded.
await page.locator('button[title="Verify in matchup calc"]').nth(1).click();
await page.waitForTimeout(700);
const backOnMatchup = (await page.getByText('max offense', { exact: false }).count()) > 0;
const damageShown = (await page.getByText(/\d+(\.\d+)? - \d+(\.\d+)?%/).count()) > 0;
await page.screenshot({ path: (process.argv[2] ?? 'ms') + '-verify.png', fullPage: false });

console.log('qualifiers:', canText?.trim(), '| top rows:', JSON.stringify(topFive));
console.log('cell verify → matchup loaded:', backOnMatchup, '| damage shown:', damageShown);
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(errors.length || !canText || !backOnMatchup || !damageShown ? 1 : 0);
