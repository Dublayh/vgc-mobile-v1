// Tourney smoke: events render → expand a placement → import → team editor,
// with megas correctly marked (a stone-holder shows its mega forme name).
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 414, height: 1200 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
});

await page.goto('http://localhost:5173/?seed#meta', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Tourney', exact: true }).click();
await page.waitForSelector('text=/#\\d/', { timeout: 20000 });
const events = await page.locator('section').count();

await page.getByRole('button', { name: /#1/ }).first().click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Import to my teams' }).click();
await page.waitForTimeout(800);

const teamName = await page.locator('input').first().inputValue();
const violations = await page.getByText(/cannot|must hold|does not exist/i).count();
// If any slot holds a mega stone, its card must show the -MEGA forme name.
const stoneCards = await page.getByText(/ite Y|ite X|Floettite|chompite|Swampertite/).count();
const megaNames = await page.getByText(/-Mega/i).count();
await page.screenshot({ path: process.argv[2] ?? 'tourney.png', fullPage: true });

console.log('event panels:', events, '| imported:', JSON.stringify(teamName?.slice(0, 40)));
console.log('violations:', violations, '| stone cards:', stoneCards, '| mega-forme names:', megaNames);
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(
  errors.length || !teamName || violations > 0 || (stoneCards > 0 && megaNames === 0) ? 1 : 0,
);
