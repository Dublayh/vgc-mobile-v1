// Calc-tab smoke: seed demo team → Calc tab → pick attacker + defender →
// damage rows render → expand best row. Exits non-zero on page errors.
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 414, height: 1100 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
});

await page.goto('http://localhost:5173/?seed#calc', { waitUntil: 'networkidle' });

// Attacker: first option (Garchomp-Mega of the demo team)
await page.getByRole('button', { name: /garchomp/i }).first().click();
// Defender panel now shows its picker list; choose Tyranitar
await page.getByRole('button', { name: /tyranitar/i }).last().click();
await page.waitForTimeout(500);

const rows = await page.getByText(/%/).count();
await page.getByText('Earthquake').first().click(); // expand detail
await page.waitForTimeout(300);
const hasDescription = await page.getByText(/vs\./).first().isVisible().catch(() => false);

// Panels are located by their heading — loose text matching also hits the
// Damage panel ("…vs this defender").
const panelByHeading = (name) =>
  page.locator('section').filter({ has: page.getByRole('heading', { name, exact: true }) });

// Team pick must carry the SAVED spread (demo Garchomp = 66/66) and say so.
const attackerPanel = panelByHeading('Attacker');
const savedSpreadShown =
  (await attackerPanel.getByText(/66\/66 SP/).count()) > 0 &&
  (await attackerPanel.getByText(/from Sand core/).count()) > 0;

// Defender from the whole dex (not a saved team): switch source and search.
// Kingambit is #1 in usage, so the pick must seed its real meta set (not 0 SP).
const defenderPanel = panelByHeading('Defender');
await defenderPanel.getByRole('button', { name: 'Change' }).click();
await defenderPanel.getByRole('button', { name: 'Dex', exact: true }).click();
await defenderPanel.getByPlaceholder('Search the whole dex…').fill('kingambit');
await defenderPanel.getByRole('button', { name: /kingambit/i }).click();
await page.waitForTimeout(400);
const dexDefenderRows = await page.getByText(/%/).count();
const seedLabel = await defenderPanel.getByText(/\/66 SP/).textContent().catch(() => '');
const usageSeeded = !!seedLabel && !seedLabel.includes('0/66');

// Editing the spread must change the damage result.
const firstRow = () => page.locator('section', { hasText: 'Damage' }).last().getByText(/\d+(\.\d+)? - \d+(\.\d+)?%/).first().textContent();
const before = await firstRow();
await defenderPanel.getByRole('button', { name: 'Edit set' }).click();
await defenderPanel.getByText('Clear', { exact: true }).click(); // 0 SP preset (not the item ✕)
await page.waitForTimeout(400);
const after = await firstRow();
const editChangesDamage = before !== after;

// Team-sourced attacker must be adjustable too (calc-only scratch edit).
await attackerPanel.getByRole('button', { name: 'Edit set' }).click();
await attackerPanel.getByText('Clear', { exact: true }).click();
await page.waitForTimeout(400);
const afterTeamEdit = await firstRow();
const teamEditChangesDamage = afterTeamEdit !== after;
const editedMarker = (await attackerPanel.getByText(/edited \(calc only\)/).count()) > 0;

await page.screenshot({ path: process.argv[2] ?? 'calc.png', fullPage: true });
console.log('damage rows with %:', rows, '| expanded description visible:', hasDescription);
console.log('team pick shows saved spread:', savedSpreadShown);
console.log('rows vs dex defender:', dexDefenderRows, '| usage-seeded:', usageSeeded, `(${seedLabel?.trim()})`, '| edit changes damage:', editChangesDamage, `(${before} → ${after})`);
console.log('team-sourced edit changes damage:', teamEditChangesDamage, `(${after} → ${afterTeamEdit})`, '| edited marker:', editedMarker);
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(
  errors.length ||
    rows === 0 ||
    dexDefenderRows === 0 ||
    !savedSpreadShown ||
    !usageSeeded ||
    !editChangesDamage ||
    !teamEditChangesDamage ||
    !editedMarker
    ? 1
    : 0,
);
