import { describe, expect, test } from 'vitest';
import { DexLookup, type RegulationData } from '../../data/dex';
import { UsageLookup, type UsageMon } from '../../data/usage';
import { EMPTY_SP, type ChampionsSet, type SPSpread, type AlignmentName } from '../../engine/types';
import { usageMonToSet } from '../meta/threatSet';
import {
  auditSuggestion,
  detectArchetypes,
  metaWeights,
  rolesOf,
  suggestPartners,
  usagePrior,
} from './completer';
// Real generated bundles: the suggestions must resolve against actual roster data.
import dexJson from '../../../public/data/dex.json';
import regJson from '../../../public/data/regulations/m-c.json';

const lookup = new DexLookup(
  dexJson as unknown as ConstructorParameters<typeof DexLookup>[0],
  regJson as unknown as RegulationData,
);

const ATK: SPSpread = { ...EMPTY_SP, hp: 2, atk: 32, spe: 32 };
const SPA: SPSpread = { ...EMPTY_SP, hp: 32, spa: 32, spd: 2 };

function mon(
  name: string,
  usage: number,
  o: {
    ability: string;
    item?: string;
    moves: string[];
    teammates?: [string, number][];
    alignment?: AlignmentName;
    sp?: SPSpread;
  },
): UsageMon {
  return {
    name,
    rank: 0,
    usage,
    abilities: [[o.ability, 1]],
    items: o.item ? [[o.item, 1]] : [],
    moves: o.moves.map((m) => [m, 0.9]),
    spreads: [{ alignment: o.alignment ?? 'Adamant', sp: o.sp ?? ATK, pct: 0.3 }],
    teammates: o.teammates ?? [],
  };
}

// A miniature ladder. Teammate rates are FRACTIONS OF THAT MON'S TEAMS.
const MONS: UsageMon[] = [
  mon('Rillaboom', 0.46, {
    ability: 'Grassy Surge',
    item: 'Miracle Seed',
    moves: ['Fake Out', 'Grassy Glide', 'Wood Hammer', 'U-turn'],
    teammates: [['Incineroar', 0.39]],
  }),
  mon('Sneasler', 0.37, {
    ability: 'Unburden',
    item: 'Grassy Seed',
    moves: ['Close Combat', 'Dire Claw', 'Fake Out', 'Protect'],
    alignment: 'Jolly',
  }),
  mon('Incineroar', 0.3, {
    ability: 'Intimidate',
    item: 'Sitrus Berry',
    moves: ['Fake Out', 'Flare Blitz', 'Knock Off', 'Parting Shot'],
    teammates: [['Rillaboom', 0.6]],
  }),
  mon('Archaludon', 0.16, {
    ability: 'Stamina',
    item: 'Leftovers',
    moves: ['Electro Shot', 'Draco Meteor', 'Flash Cannon', 'Protect'],
    teammates: [['Pelipper', 0.2]],
    alignment: 'Modest',
    sp: SPA,
  }),
  mon('Garchomp', 0.08, {
    ability: 'Rough Skin',
    item: 'Life Orb',
    moves: ['Earthquake', 'Dragon Claw', 'Rock Slide', 'Protect'],
  }),
  mon('Pelipper', 0.05, {
    ability: 'Drizzle',
    item: 'Focus Sash',
    moves: ['Hurricane', 'Weather Ball', 'Tailwind', 'Protect'],
    teammates: [['Archaludon', 0.66]],
    alignment: 'Modest',
    sp: SPA,
  }),
  mon('Torkoal', 0.05, {
    ability: 'Drought',
    item: 'Charcoal',
    moves: ['Eruption', 'Heat Wave', 'Protect', 'Yawn'],
    alignment: 'Quiet',
    sp: SPA,
  }),
  mon('Garchomp-Mega', 0.03, {
    ability: 'Sand Force',
    item: 'Garchompite',
    moves: ['Earthquake', 'Dragon Claw', 'Rock Slide', 'Protect'],
  }),
  mon('Grapploct', 0.002, {
    ability: 'Technician',
    item: 'Focus Sash',
    moves: ['Drain Punch', 'Sucker Punch', 'Fake Out', 'Protect'],
  }),
].map((m, i) => ({ ...m, rank: i + 1 }));

const usage = new UsageLookup({
  format: 'test',
  month: '2026-09',
  totalBattles: 1,
  generatedAt: '',
  mons: MONS,
});

const setOf = (name: string): ChampionsSet => usageMonToSet(usage.get(name)!, lookup)!;
const names = (r: ReturnType<typeof suggestPartners>) => r.suggestions.map((s) => s.name);
const find = (r: ReturnType<typeof suggestPartners>, name: string) =>
  r.suggestions.find((s) => s.name === name)!;

describe('suggestPartners', () => {
  test('teammate co-occurrence is read from either side and reported as a share of teams', () => {
    // Pelipper's own list says Archaludon is on 66% of its teams.
    const r = suggestPartners([setOf('Pelipper')], usage, lookup, { limit: 20 });
    expect(find(r, 'Archaludon').evidence).toContain('on 66% of Pelipper teams');
    // Reverse direction: Incineroar's list carries the Rillaboom pairing (60%),
    // which is stronger than Rillaboom's own 39% entry — the max wins.
    const r2 = suggestPartners([setOf('Rillaboom')], usage, lookup, { limit: 20 });
    expect(find(r2, 'Incineroar').evidence).toContain('on 60% of Rillaboom teams');
  });

  test('a strong proven partner out-ranks a higher-usage mon with no pairing', () => {
    const r = suggestPartners([setOf('Pelipper')], usage, lookup, { limit: 20 });
    const order = names(r);
    expect(order.indexOf('Archaludon')).toBeLessThan(order.indexOf('Garchomp'));
    expect(order.indexOf('Archaludon')).toBeLessThan(order.indexOf('Sneasler'));
  });

  test('one row per species: the mega and base forme collapse to the better one', () => {
    const r = suggestPartners([setOf('Pelipper')], usage, lookup, { limit: 20 });
    const garchomps = r.suggestions.filter((s) => s.base === 'Garchomp');
    expect(garchomps).toHaveLength(1);
  });

  test('fringe mons below the usage floor are skipped even with a role to offer', () => {
    const r = suggestPartners([setOf('Archaludon')], usage, lookup, { limit: 50 });
    expect(names(r)).not.toContain('Grapploct');
  });

  test('species clause excludes locked species in any forme', () => {
    const r = suggestPartners([setOf('Garchomp-Mega')], usage, lookup, { limit: 50 });
    expect(names(r)).not.toContain('Garchomp');
    expect(names(r)).not.toContain('Garchomp-Mega');
  });

  test('role gaps are rewarded only when the team lacks them', () => {
    // Pelipper brings Tailwind (speed control) but no Fake Out / Intimidate.
    const r = suggestPartners([setOf('Pelipper')], usage, lookup, { limit: 20 });
    expect(r.roles.has('speed control')).toBe(true);
    const inc = find(r, 'Incineroar');
    expect(inc.evidence).toContain('adds Fake Out');
    expect(inc.evidence).toContain('adds Intimidate');
    // Once Incineroar is locked too, Fake Out is no longer a gap for Rillaboom.
    const r2 = suggestPartners([setOf('Pelipper'), setOf('Incineroar')], usage, lookup, { limit: 20 });
    expect(find(r2, 'Rillaboom').evidence).not.toContain('adds Fake Out');
  });

  test('a conflicting weather setter is flagged and penalized', () => {
    const r = suggestPartners([setOf('Torkoal')], usage, lookup, { limit: 20 });
    const pel = find(r, 'Pelipper');
    expect(pel.evidence).toContain('rain conflicts with sun');
    // Same core without the weather ability: identical otherwise, no penalty.
    const noSun = suggestPartners([{ ...setOf('Torkoal'), ability: 'White Smoke' }], usage, lookup, { limit: 20 });
    expect(pel.fit).toBeLessThan(find(noSun, 'Pelipper').fit);
  });

  test('coverage evidence only names types the meta actually carries', () => {
    const w = metaWeights(usage, lookup);
    expect(w.defending.Grass).toBe(1); // Rillaboom tops this ladder
    expect(w.defending.Ice).toBe(0); // nobody here is Ice
    const r = suggestPartners([setOf('Rillaboom')], usage, lookup, { limit: 20 });
    for (const s of r.suggestions) {
      const cov = s.evidence.find((e) => e.startsWith('covers '));
      if (cov) expect(cov).not.toMatch(/Ice|Bug|Normal/);
    }
  });

  test('usage prior is flat across proven picks but crushes fringe ones', () => {
    expect(usagePrior(0.46)).toBe(usagePrior(0.08));
    expect(usagePrior(0.16) / usagePrior(0.04)).toBeLessThan(1.5);
    expect(usagePrior(0.16) / usagePrior(0.005)).toBeGreaterThan(6);
  });
});

describe('rolesOf / detectArchetypes', () => {
  test('roles come from moves and ability', () => {
    expect(rolesOf(setOf('Incineroar'))).toEqual(['Fake Out', 'Intimidate']);
    expect(rolesOf(setOf('Pelipper'))).toEqual(['speed control']);
    expect(rolesOf(setOf('Archaludon'))).toEqual([]);
  });

  test('a majority of slow mons implies Trick Room; Drizzle implies Rain', () => {
    const slow = [setOf('Torkoal'), { ...setOf('Torkoal'), species: 'Hatterene', ability: 'Magic Bounce' }];
    expect(detectArchetypes(slow, lookup)).toContain('Trick Room');
    // Archaludon (105 Spe) breaks the slow majority.
    expect(detectArchetypes([setOf('Torkoal'), setOf('Archaludon')], lookup)).not.toContain('Trick Room');
    expect(detectArchetypes([setOf('Pelipper')], lookup)).toEqual(['Rain', 'Tailwind']);
  });
});

describe('auditSuggestion', () => {
  const base = suggestPartners([setOf('Pelipper')], usage, lookup, { limit: 20 });
  const garchomp = find(base, 'Garchomp');

  test('a clean win adds "beats" evidence and raises the score', () => {
    // Torkoal's fire is resisted and Garchomp out-damages it: safe.
    const harmless: ChampionsSet = { ...setOf('Torkoal'), moves: ['Protect', 'Yawn'] };
    const out = auditSuggestion(garchomp, [{ name: 'Torkoal', set: harmless, usage: 0.05 }]);
    expect(out.audit?.beats).toEqual(['Torkoal']);
    expect(out.evidence).toContain('beats Torkoal');
    expect(out.score).toBeGreaterThan(garchomp.score);
  });

  test('a lost matchup adds "loses to" and lowers the score', () => {
    const unarmed = { ...garchomp, set: { ...garchomp.set, moves: ['Protect'] as ChampionsSet['moves'] } };
    const out = auditSuggestion(unarmed, [{ name: 'Sneasler', set: setOf('Sneasler'), usage: 0.37 }]);
    expect(out.audit?.losesTo).toEqual(['Sneasler']);
    expect(out.evidence).toContain('loses to Sneasler');
    expect(out.score).toBeLessThan(garchomp.score);
  });

  test('the mirror matchup is not evidence', () => {
    const out = auditSuggestion(garchomp, [{ name: 'Garchomp', set: setOf('Garchomp'), usage: 0.08 }]);
    expect(out.audit).toEqual({ beats: [], losesTo: [], shaky: [] });
    expect(out.score).toBe(garchomp.score);
  });
});
