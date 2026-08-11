// Meta-tab smoke: usage list → mon detail → speed tiers → threat audit verdicts.
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 414, height: 1100 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
});

await page.goto('http://localhost:5173/?seed#meta', { waitUntil: 'networkidle' });

// Usage list → detail
await page.getByRole('button', { name: /garchomp/i }).first().click();
await page.waitForTimeout(300);
const spreadsVisible = await page.getByText('Spreads (SP)').isVisible().catch(() => false);
await page.screenshot({ path: (process.argv[2] ?? 'meta') + '-usage.png', fullPage: true });

// Speed tiers
await page.getByRole('button', { name: 'Usage', exact: true }).click(); // back via segment? no — go back first
await page.getByRole('button', { name: '‹ Usage' }).click().catch(() => {});
await page.getByRole('button', { name: 'Speed', exact: true }).click();
await page.waitForTimeout(400);
const speedRows = await page.getByText(/max speed/).count();
await page.screenshot({ path: (process.argv[2] ?? 'meta') + '-speed.png', fullPage: true });

// Threat audit
await page.getByRole('button', { name: 'Threats', exact: true }).click();
await page.getByPlaceholder(/pick a threat/i).fill('gholdengo');
await page.getByRole('button', { name: /gholdengo/i }).first().click();
await page.waitForTimeout(600);
const verdicts = await page.getByText(/safe|shaky|loses/i).count();
await page.screenshot({ path: (process.argv[2] ?? 'meta') + '-threats.png', fullPage: true });

console.log(
  'detail spreads visible:', spreadsVisible,
  '| speed rows:', speedRows,
  '| verdict chips:', verdicts,
);
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(errors.length || !spreadsVisible || speedRows === 0 || verdicts === 0 ? 1 : 0);
