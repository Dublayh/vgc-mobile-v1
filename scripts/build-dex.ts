/**
 * Emits public/data/dex.json: a trimmed dex (species, learnsets, moves, items,
 * abilities) covering only the current regulation's roster, so the app ships a
 * small data bundle instead of the full Showdown dex.
 *
 * Run build-regulation.ts first (npm run data:all does both in order).
 */
import { Dex } from '@pkmn/dex';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(import.meta.dirname, '..', 'public', 'data');
const VENDOR_DIR = join(import.meta.dirname, 'vendor');

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Champions grants extra TM/tutor moves beyond the mainline gen-9 learnsets
 * (e.g. Ancient Power on Camerupt). Showdown encodes these as ADDITIVE diffs
 * in data/mods/champions/learnsets.ts — @pkmn/dex does not bundle mods, so we
 * vendor that file and union it in. Refresh with REFRESH_MODS=1, which
 * re-downloads from the showdown repo before building.
 */
const MOD_LEARNSETS_URL =
  'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/champions/learnsets.ts';

async function loadModLearnsets(): Promise<Map<string, string[]>> {
  const vendored = join(VENDOR_DIR, 'champions-learnsets.ts');
  if (process.env.REFRESH_MODS) {
    const res = await fetch(MOD_LEARNSETS_URL);
    if (!res.ok) {
      console.error(`✗ failed to refresh champions learnsets (${res.status})`);
      process.exit(1);
    }
    writeFileSync(vendored, await res.text());
    console.log('↻ refreshed vendor/champions-learnsets.ts');
  }
  let src = readFileSync(vendored, 'utf8');
  src = src.slice(src.indexOf('= {') + 2);
  const table = new Function('return ' + src.trim().replace(/;\s*$/, ''))() as Record<
    string,
    { learnset?: Record<string, string[]> }
  >;
  const map = new Map<string, string[]>();
  for (const [id, entry] of Object.entries(table)) {
    if (entry.learnset) map.set(id, Object.keys(entry.learnset));
  }
  return map;
}

const modLearnsets = await loadModLearnsets();
const meta = JSON.parse(readFileSync(join(DATA_DIR, 'meta.json'), 'utf8'));
const reg = JSON.parse(
  readFileSync(join(DATA_DIR, 'regulations', `${meta.currentRegulation}.json`), 'utf8'),
);

const speciesNames: string[] = [
  ...reg.allowedSpecies,
  ...Object.values(reg.megaFormes as Record<string, string[]>).flat(),
];

// Megas resolve learnsets against their base species — unless that base is not
// itself roster-legal, in which case use the roster's forme of it (e.g.
// Floette-Mega → Floette-Eternal because plain Floette is illegal). The
// allowed-set guard keeps Raichu-Mega resolving to Raichu, not Raichu-Alola.
const allowedIds = new Set((reg.allowedSpecies as string[]).map(toId));
const rosterByBase = new Map<string, string>();
for (const name of reg.allowedSpecies as string[]) {
  const sp = Dex.species.get(name);
  if (sp.exists && !rosterByBase.has(toId(sp.baseSpecies || sp.name))) {
    rosterByBase.set(toId(sp.baseSpecies || sp.name), name);
  }
}

const usedMoves = new Set<string>();
const usedAbilities = new Set<string>();

interface DexSpecies {
  id: string;
  name: string;
  num: number;
  types: string[];
  baseStats: Record<string, number>;
  abilities: string[];
  weightkg: number;
  baseSpecies?: string; // set for mega formes
  learnset: string[];   // move ids; megas share their base forme's learnset
  spriteId: string;     // Showdown sprite filename stem, e.g. "ninetales-alola"
}

async function buildSpecies(name: string): Promise<DexSpecies> {
  const s = Dex.species.get(name);
  if (!s.exists) throw new Error(`Unknown species "${name}"`);

  // Some Champions megas (Meowstic-M-Mega/-F-Mega) lack the isMega flag but
  // carry "Mega" in their forme name — treat those as megas too.
  const isMega = !!s.isMega || /(^|-)Mega(-[XY])?$/.test(s.forme ?? '');

  // Megas learn what their base forme learns — using the roster-legal forme
  // of that base only when the base itself is illegal (Floette-Eternal case).
  const learnsetSource = isMega
    ? allowedIds.has(toId(s.baseSpecies))
      ? s.baseSpecies
      : (rosterByBase.get(toId(s.baseSpecies)) ?? s.baseSpecies)
    : s.name;
  const data = await Dex.learnsets.get(learnsetSource);
  const mainline = Object.keys(data?.learnset ?? {}).filter((moveId) => {
    const move = Dex.moves.get(moveId);
    // Keep gen-9-legal moves only (drops Hidden Power, Return, etc.).
    return move.exists && !move.isNonstandard;
  });
  // Union in Champions-specific TM/tutor additions (authoritative: the mod).
  const additions = (
    modLearnsets.get(toId(learnsetSource)) ??
    modLearnsets.get(toId(s.name)) ??
    []
  ).filter((moveId) => Dex.moves.get(moveId).exists);
  const learnset = [...new Set([...mainline, ...additions])];
  for (const m of learnset) usedMoves.add(m);

  const abilities = Object.values(s.abilities).filter(Boolean) as string[];
  for (const a of abilities) usedAbilities.add(a);

  return {
    id: s.id,
    name: s.name,
    num: s.num,
    types: [...s.types],
    baseStats: { ...s.baseStats },
    abilities,
    weightkg: s.weightkg,
    ...(isMega ? { baseSpecies: s.baseSpecies } : {}),
    learnset,
    spriteId:
      s.name === s.baseSpecies ? toId(s.name) : `${toId(s.baseSpecies)}-${toId(s.forme)}`,
  };
}

const species = await Promise.all(speciesNames.map(buildSpecies));

/** Practicality tag for moves you "could but wouldn't" click (OHKO sweep UX). */
function moveDrawback(id: string): string | undefined {
  const m = Dex.moves.get(id);
  if (m.flags.recharge) return 'recharge';
  if (m.flags.charge) return 'charge turn';
  if (m.selfdestruct === 'always') return 'self-KO';
  if (id === 'focuspunch' || id === 'shelltrap') return 'interruptible';
  if (id === 'dreameater' || id === 'lastresort' || id === 'belch') return 'conditional';
  return undefined;
}

const moves = [...usedMoves].sort().map((id) => {
  const m = Dex.moves.get(id);
  const drawback = moveDrawback(id);
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    category: m.category,
    basePower: m.basePower,
    accuracy: m.accuracy === true ? null : m.accuracy,
    priority: m.priority,
    target: m.target,
    shortDesc: m.shortDesc,
    ...(drawback ? { drawback } : {}),
  };
});

const abilities = [...usedAbilities].sort().map((name) => {
  const a = Dex.abilities.get(name);
  return { id: a.id, name: a.name, shortDesc: a.shortDesc };
});

// Battle-relevant held items legal in gen 9, minus regulation bans.
const items = Dex.items
  .all()
  .filter(
    (i) =>
      !i.isNonstandard &&
      !i.isPokeball &&
      !reg.bannedItems.includes(i.name) &&
      (i.fling || i.megaStone || i.onPlate || i.isBerry),
  )
  .map((i) => {
    // @pkmn/dex models mega stones as { [baseSpecies]: megaForme }.
    const megaEvolves = i.megaStone ? Object.keys(i.megaStone)[0] : undefined;
    return {
      id: i.id,
      name: i.name,
      shortDesc: i.shortDesc || i.desc,
      ...(megaEvolves
        ? { megaEvolves, megaForme: (i.megaStone as Record<string, string>)[megaEvolves] }
        : {}),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const out = {
  regulation: reg.id,
  generatedAt: new Date().toISOString(),
  species,
  moves,
  abilities,
  items,
};

writeFileSync(join(DATA_DIR, 'dex.json'), JSON.stringify(out));
const kb = (JSON.stringify(out).length / 1024).toFixed(0);
console.log(
  `✓ dex.json — ${species.length} species, ${moves.length} moves, ` +
    `${abilities.length} abilities, ${items.length} items (${kb} KB raw)`,
);

// Validation: every move observed on the real ladder must be in our learnsets.
// A miss means the vendored champions mod file is stale (REFRESH_MODS=1) or a
// forme resolves its learnset against the wrong source.
try {
  const usage = JSON.parse(
    readFileSync(join(DATA_DIR, 'usage', `${meta.currentRegulation}.json`), 'utf8'),
  );
  const byId = new Map(species.map((s) => [toId(s.name), s]));
  let misses = 0;
  for (const mon of usage.mons ?? []) {
    const sp = byId.get(toId(mon.name));
    if (!sp) continue;
    const ls = new Set(sp.learnset);
    for (const [move] of mon.moves as [string, number][]) {
      if (!ls.has(toId(move))) {
        misses++;
        console.error(`  ✗ usage move missing from learnset: ${mon.name} → ${move}`);
      }
    }
  }
  if (misses > 0) {
    console.error(`✗ ${misses} ladder-observed moves missing — try REFRESH_MODS=1 npm run data:dex`);
    process.exit(1);
  }
  console.log('✓ all ladder-observed moves present in learnsets');
} catch {
  console.warn('  ⚠ no usage bundle — skipped learnset cross-check');
}
