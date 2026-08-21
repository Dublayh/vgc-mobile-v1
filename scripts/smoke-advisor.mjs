// M4b smoke: threat audit → counter list → deep-link to calc; team completer
// suggests, adds a slot, and re-ranks. Exits non-zero on failure or page error.
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 414, height: 1200 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
});

// --- CounterFinder + deep link ---
await page.goto('http://localhost:5173/?seed#meta', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Threats', exact: true }).click();
await page.getByRole('button', { name: 'Browse by usage' }).click();
await page.getByPlaceholder(/pick a threat/i).fill('garchomp');
await page.getByRole('button', { name: /garchomp/i }).first().click();
await page.waitForSelector('text=Best answers to', { timeout: 20000 });
const counterCount = await page.getByText('Verify in calc ›').count();
await page.screenshot({ path: (process.argv[2] ?? 'advisor') + '-counters.png', fullPage: true });

await page.getByText('Verify in calc ›').first().click();
await page.waitForTimeout(800);
const calcLoaded = (await page.getByText(/Damage/).count()) > 0;
const calcRows = await page.getByText(/%/).count();

// --- Team Completer: suggest → add → re-rank ---
// (hash-only navigation doesn't re-init the store; force a reload)
await page.goto('http://localhost:5173/?seed#teams/demo-team', { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: /complete team/i }).click();
await page.waitForSelector('text=suggestions', { timeout: 20000 });
const firstSuggestion = await page
  .locator('section', { hasText: 'suggestions' })
  .last()
  .locator('span.font-display')
  .first()
  .textContent();
const slotLabelBefore = await page.getByText(/Slot \d suggestions/).textContent();
await page.getByRole('button', { name: '+ Add' }).first().click();
await page.waitForTimeout(700);
const slotLabelAfter = await page.getByText(/Slot \d suggestions|Team is full/).textContent();
const reranked = slotLabelBefore !== slotLabelAfter;
await page.screenshot({ path: (process.argv[2] ?? 'advisor') + '-completer.png', fullPage: true });

// Clean up the added slot so the demo team stays at 4 (seed re-adds anyway on ?seed).
console.log('counters:', counterCount, '| deep-link calc loaded:', calcLoaded, 'rows:', calcRows);
console.log('first suggestion:', firstSuggestion?.trim(), '|', slotLabelBefore?.trim(), '→', slotLabelAfter?.trim(), '| re-ranked:', reranked);
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(errors.length || counterCount === 0 || !calcLoaded || calcRows === 0 || !reranked ? 1 : 0);
