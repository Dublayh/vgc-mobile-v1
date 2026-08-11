/**
 * Showdown paste import/export (plan §4 import-export).
 * Import: accepts standard pastes — EV spreads are translated to the nearest
 * legal SP spread (1 SP ≈ 8 EVs) — plus our native `SP:` line losslessly.
 * Export: native mode writes `SP:`; interop mode writes `EVs:` (SP × 8) so
 * pastes drop straight into mainline calc sites.
 */
import { evsToNearestSP, spToEVs } from '../../engine/stats';
import {
  ALIGNMENTS,
  type AlignmentName,
  EMPTY_SP,
  type ChampionsSet,
  STAT_IDS,
  type StatID,
  type StatsTable,
} from '../../engine/types';

const STAT_ALIASES: Record<string, StatID> = {
  hp: 'hp', atk: 'atk', def: 'def', spa: 'spa', spd: 'spd', spe: 'spe',
  attack: 'atk', defense: 'def', 'sp. atk': 'spa', 'sp. def': 'spd', speed: 'spe',
  spatk: 'spa', spdef: 'spd',
};

const STAT_EXPORT: Record<StatID, string> = {
  hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe',
};

function parseSpreadLine(body: string): StatsTable {
  const table = { ...EMPTY_SP };
  for (const part of body.split('/')) {
    const m = part.trim().match(/^(\d+)\s+(.+)$/);
    if (!m) continue;
    const stat = STAT_ALIASES[m[2].trim().toLowerCase()];
    if (stat) table[stat] = parseInt(m[1], 10);
  }
  return table;
}

/** "Nickname (Species) @ Item", gender markers, or plain "Species @ Item". */
function parseHeader(line: string): { species: string; item?: string } {
  let name = line;
  let item: string | undefined;
  const at = line.indexOf(' @ ');
  if (at >= 0) {
    item = line.slice(at + 3).trim();
    name = line.slice(0, at);
  }
  name = name.replace(/\s*\((M|F)\)\s*$/i, '').trim();
  const paren = name.match(/\(([^)]+)\)\s*$/);
  if (paren) name = paren[1].trim();
  return { species: name, item };
}

/** Mega formes come in as their own species name ("Garchomp-Mega"). */
function splitMegaForme(species: string): { species: string; megaStone?: string } {
  const m = species.match(/^(.*)-Mega(-[XY])?$/);
  return m ? { species: m[1], megaStone: species } : { species };
}

export function parsePaste(paste: string): ChampionsSet[] {
  const blocks = paste
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const header = parseHeader(lines[0]);
    const { species, megaStone } = splitMegaForme(header.species);

    const set: ChampionsSet = {
      species,
      ...(megaStone ? { megaStone } : {}),
      ability: '',
      ...(header.item ? { item: header.item } : {}),
      alignment: 'Serious',
      sp: { ...EMPTY_SP },
      moves: [],
    };

    for (const line of lines.slice(1)) {
      if (line.startsWith('- ')) {
        if (set.moves.length < 4) set.moves.push(line.slice(2).trim());
      } else if (/^ability:/i.test(line)) {
        set.ability = line.slice(line.indexOf(':') + 1).trim();
      } else if (/^sp:/i.test(line)) {
        set.sp = parseSpreadLine(line.slice(line.indexOf(':') + 1));
      } else if (/^evs:/i.test(line)) {
        set.sp = evsToNearestSP(parseSpreadLine(line.slice(line.indexOf(':') + 1)));
      } else if (/nature$/i.test(line)) {
        const nature = line.replace(/\s*nature$/i, '').trim();
        if (nature in ALIGNMENTS) set.alignment = nature as AlignmentName;
      }
      // Level / IVs / Shiny / Tera lines are irrelevant in Champions — ignored.
    }
    return set;
  });
}

export interface SerializeOptions {
  /** 'sp' = native Champions paste; 'evs' = mainline calc-site interop (SP × 8). */
  spread: 'sp' | 'evs';
}

export function serializeSet(set: ChampionsSet, opts: SerializeOptions = { spread: 'sp' }): string {
  const lines: string[] = [];
  const displaySpecies = set.megaStone ?? set.species;
  lines.push(set.item ? `${displaySpecies} @ ${set.item}` : displaySpecies);
  if (set.ability) lines.push(`Ability: ${set.ability}`);
  lines.push('Level: 50');

  const spread = opts.spread === 'evs' ? spToEVs(set.sp) : set.sp;
  const parts = STAT_IDS.filter((s) => spread[s] > 0).map(
    (s) => `${spread[s]} ${STAT_EXPORT[s]}`,
  );
  if (parts.length) lines.push(`${opts.spread === 'evs' ? 'EVs' : 'SP'}: ${parts.join(' / ')}`);

  lines.push(`${set.alignment} Nature`);
  for (const move of set.moves) if (move) lines.push(`- ${move}`);
  return lines.join('\n');
}

export function serializeTeam(
  sets: ChampionsSet[],
  opts: SerializeOptions = { spread: 'sp' },
): string {
  return sets.map((s) => serializeSet(s, opts)).join('\n\n');
}
