/**
 * Emits public/data/usage/<regulation>.json: Smogon ladder usage stats for the
 * current regulation, transformed from the raw chaos JSON
 * (https://www.smogon.com/stats/<month>/chaos/<format>-<rating>.json).
 *
 * - Month: env MONTH=YYYY-MM, else walks back from last month up to 3 months.
 * - Rating cutoff: first available of 1630, 1760, 1500, 0.
 * - Fails loudly (exit 1) if no chaos file exists — never writes a stale file.
 *
 * Note: the Champions chaos Spreads are already SP-scaled ("Adamant:32/32/0/0/2/0",
 * per-stat ≤ 32, totals ≤ 66). We detect the scale per spread anyway and convert
 * EV-style spreads via evsToNearestSP() in case Smogon ever changes the reporting.
 */
import { Dex } from '@pkmn/dex';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type StatsTable = { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };

// Reuse the engine's EV→SP conversion. tsconfig.node.json's composite project
// doesn't include src/, so a static import would fail `tsc -b` (TS6307); a
// computed-specifier dynamic import is invisible to the project type-check and
// resolves fine under tsx at runtime.
const statsModuleUrl = new URL('../src/engine/stats.ts', import.meta.url).href;
const { evsToNearestSP } = (await import(statsModuleUrl)) as {
  evsToNearestSP: (evs: StatsTable) => StatsTable;
};

const DATA_DIR = join(import.meta.dirname, '..', 'public', 'data');
const STATS_BASE = 'https://www.smogon.com/stats';
const RATING_PREFERENCE = [1630, 1760, 1500, 0];
const MONTHS_TO_TRY = 3;

interface UsageMon {
  name: string;
  rank: number;
  usage: number;
  abilities: [string, number][];
  items: [string, number][];
  moves: [string, number][];
  spreads: { alignment: string; sp: StatsTable; pct: number }[];
  teammates: [string, number][];
}

interface UsageData {
  format: string;
  month: string;
  totalBattles: number;
  synthetic?: boolean; // never set here — only the checked-in sample uses it
  generatedAt: string;
  mons: UsageMon[];
  /** slim snapshot of the prior month for trends: [name, usage, rank] */
  previous?: { month: string; mons: [string, number, number][] };
}

interface ChaosMon {
  'Raw count': number;
  usage: number;
  Abilities: Record<string, number>;
  Items: Record<string, number>;
  Moves: Record<string, number>;
  Spreads: Record<string, number>;
  Teammates: Record<string, number>;
}

interface ChaosFile {
  info: { metagame: string; cutoff: number; 'number of battles': number };
  data: Record<string, ChaosMon>;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** Normalize a weighted-count map to shares of its own sum (0..1). */
function toShares(map: Record<string, number>): [string, number][] {
  const entries = Object.entries(map);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) return [];
  return entries
    .map(([k, w]): [string, number] => [k, w / total])
    .sort((a, b) => b[1] - a[1]);
}

function candidateMonths(): string[] {
  if (process.env.MONTH) {
    if (!/^\d{4}-\d{2}$/.test(process.env.MONTH)) {
      console.error(`Invalid MONTH "${process.env.MONTH}" — expected YYYY-MM.`);
      process.exit(1);
    }
    return [process.env.MONTH];
  }
  const months: string[] = [];
  const d = new Date();
  for (let i = 1; i <= MONTHS_TO_TRY; i++) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    months.push(`${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

async function findChaosFile(
  formatBase: string,
): Promise<{ month: string; rating: number; chaos: ChaosFile }> {
  const tried: string[] = [];
  for (const month of candidateMonths()) {
    for (const rating of RATING_PREFERENCE) {
      const url = `${STATS_BASE}/${month}/chaos/${formatBase}-${rating}.json`;
      tried.push(url);
      const res = await fetch(url);
      if (res.ok) {
        console.log(`Using ${url}`);
        return { month, rating, chaos: (await res.json()) as ChaosFile };
      }
      if (res.status !== 404) {
        console.warn(`  ${url} → HTTP ${res.status}, trying next candidate`);
      }
    }
    console.log(`No ${formatBase} chaos file for ${month}, walking back a month.`);
  }
  console.error(
    `No Smogon chaos stats found for "${formatBase}" in any tried month.\nTried:\n  ${tried.join('\n  ')}`,
  );
  process.exit(1);
}

/** Parse "Nature:HP/Atk/Def/SpA/SpD/Spe" and normalize to an SP spread. */
function parseSpread(key: string): { alignment: string; sp: StatsTable } | null {
  const [alignment, nums] = key.split(':');
  const parts = nums?.split('/').map(Number);
  if (!alignment || !parts || parts.length !== 6 || parts.some((n) => !Number.isFinite(n))) {
    return null;
  }
  const [hp, atk, def, spa, spd, spe] = parts;
  const table: StatsTable = { hp, atk, def, spa, spd, spe };
  const total = parts.reduce((a, b) => a + b, 0);
  // SP-scaled spreads never exceed 32/stat or 66 total; anything bigger is EVs.
  const looksLikeEVs = parts.some((n) => n > 32) || total > 66;
  return { alignment, sp: looksLikeEVs ? evsToNearestSP(table) : table };
}

function transformSpreads(raw: Record<string, number>): UsageMon['spreads'] {
  // Merge spreads that become identical after SP conversion (sum their weights).
  const merged = new Map<string, { alignment: string; sp: StatsTable; weight: number }>();
  let total = 0;
  for (const [key, weight] of Object.entries(raw)) {
    const parsed = parseSpread(key);
    if (!parsed) continue;
    total += weight;
    const id = `${parsed.alignment}:${parsed.sp.hp}/${parsed.sp.atk}/${parsed.sp.def}/${parsed.sp.spa}/${parsed.sp.spd}/${parsed.sp.spe}`;
    const existing = merged.get(id);
    if (existing) existing.weight += weight;
    else merged.set(id, { ...parsed, weight });
  }
  if (total <= 0) return [];
  return [...merged.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6)
    .map(({ alignment, sp, weight }) => ({ alignment, sp, pct: round4(weight / total) }));
}

function displayNames(
  shares: [string, number][],
  resolve: (id: string) => string | null,
  limit: number,
): [string, number][] {
  const out: [string, number][] = [];
  for (const [id, share] of shares) {
    const name = resolve(id);
    if (name === null) continue;
    out.push([name, round4(share)]);
    if (out.length === limit) break;
  }
  return out;
}

function transformMon(speciesName: string, mon: ChaosMon, rank: number): UsageMon | null {
  const species = Dex.species.get(speciesName);
  if (!species.exists) return null;

  const abilities = displayNames(
    toShares(mon.Abilities),
    (id) => {
      const a = Dex.abilities.get(id);
      return a.exists ? a.name : null;
    },
    4,
  );

  const items = displayNames(
    toShares(mon.Items),
    (id) => {
      if (id === '' || id === 'nothing') return 'Nothing';
      const item = Dex.items.get(id);
      return item.exists ? item.name : null;
    },
    8,
  );

  const moves = displayNames(
    toShares(mon.Moves),
    (id) => {
      if (id === '' || id === 'nothing') return null; // empty moveslot
      const move = Dex.moves.get(id);
      return move.exists ? move.name : null;
    },
    10,
  );

  // Teammate weights can be negative (deviation-adjusted); keep positive only.
  const positiveTeammates = Object.fromEntries(
    Object.entries(mon.Teammates).filter(([, w]) => w > 0),
  );
  const teammates = displayNames(
    toShares(positiveTeammates),
    (name) => {
      const s = Dex.species.get(name);
      return s.exists ? s.name : null;
    },
    12,
  );

  return {
    name: species.name,
    rank,
    usage: round4(mon.usage),
    abilities,
    items,
    moves,
    spreads: transformSpreads(mon.Spreads),
    teammates,
  };
}

async function buildTarget(formatBase: string, outFile: string): Promise<void> {
  const { month, rating, chaos } = await findChaosFile(formatBase);
  console.log(
    `Format ${chaos.info.metagame}, month ${month}, rating cutoff ${rating}, ` +
      `${chaos.info['number of battles']} battles, ${Object.keys(chaos.data).length} species.`,
  );

  const ranked = Object.entries(chaos.data).sort((a, b) => b[1].usage - a[1].usage);
  const mons: UsageMon[] = [];
  for (const [speciesName, raw] of ranked) {
    const mon = transformMon(speciesName, raw, mons.length + 1);
    if (!mon) {
      console.warn(`  Skipping unresolved species "${speciesName}"`);
      continue;
    }
    mons.push(mon);
    if (mons.length === 150) break;
  }

  const outDir = join(DATA_DIR, 'usage');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, outFile);

  // Trend capture: keep a slim snapshot of the month we're replacing.
  // Re-running the same month preserves the existing snapshot instead.
  let previous: UsageData['previous'];
  try {
    const existing = JSON.parse(readFileSync(outPath, 'utf8')) as UsageData;
    if (!existing.synthetic) {
      if (existing.month !== month) {
        previous = {
          month: existing.month,
          mons: existing.mons.map((m) => [m.name, m.usage, m.rank]),
        };
      } else {
        previous = existing.previous;
      }
    }
  } catch {
    /* no prior file — no trend yet */
  }

  const out: UsageData = {
    format: `${formatBase}-${rating}`,
    month,
    totalBattles: chaos.info['number of battles'],
    generatedAt: new Date().toISOString(),
    mons,
    ...(previous ? { previous } : {}),
  };
  const json = JSON.stringify(out);
  writeFileSync(outPath, json);
  console.log(`Wrote ${outPath} (${mons.length} mons, ${(json.length / 1024).toFixed(1)} KB)`);
}

async function main(): Promise<void> {
  const meta = JSON.parse(readFileSync(join(DATA_DIR, 'meta.json'), 'utf8'));
  const regulation: string = meta.currentRegulation; // e.g. "m-b"
  const regId = regulation.replace(/-/g, '');

  // Doubles (the primary VGC ladder) — REQUIRED, failure kills the run.
  await buildTarget(`gen9championsvgc2026reg${regId}`, `${regulation}.json`);

  // Singles ranked ladder (BSS-style, regulation-suffixed) — best-effort:
  // its absence must not block the doubles refresh.
  try {
    await buildTarget(`gen9championsbssreg${regId}`, `${regulation}-singles.json`);
  } catch (err) {
    console.warn(
      `Singles ladder stats unavailable — doubles bundle written, singles skipped.\n  ${(err as Error).message.split('\n')[0]}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
