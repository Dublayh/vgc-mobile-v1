import { describe, expect, test } from 'vitest';
import { DexLookup, type RegulationData } from '../../data/dex';
import { EMPTY_SP, type ChampionsSet } from '../../engine/types';
import { prepareDefender, sweepOne } from './ohkoSweep';
// Real generated bundles — the sweep spans actual regulation data.
import dexJson from '../../../public/data/dex.json';
import regJson from '../../../public/data/regulations/m-b.json';

const lookup = new DexLookup(
  dexJson as unknown as ConstructorParameters<typeof DexLookup>[0],
  regJson as unknown as RegulationData,
);

const CORVIKNIGHT: ChampionsSet = {
  species: 'Corviknight',
  ability: 'Pressure',
  alignment: 'Impish',
  sp: { ...EMPTY_SP, hp: 32, def: 32, spd: 2 },
  moves: [],
};

describe('ohkoSweep', () => {
  const defender = prepareDefender(CORVIKNIGHT);

  test('picks a super-effective move, never an immune one', () => {
    const garchomp = lookup.getSpecies('Garchomp')!;
    const entry = sweepOne(garchomp, defender, ['Flying', 'Steel'], lookup);
    expect(entry).not.toBeNull();
    expect(entry!.move).not.toBe('Earthquake'); // Flying is immune
    expect(entry!.maxPercent).toBeGreaterThan(0);
  });

  test('a fire attacker threatens far more than a neutral one', () => {
    const camerupt = lookup.getSpecies('Camerupt-Mega')!;
    const entry = sweepOne(camerupt, defender, ['Flying', 'Steel'], lookup);
    expect(entry).not.toBeNull();
    expect(entry!.category).toBe('Special'); // 145 base SpA + fire coverage
    expect(entry!.maxPercent).toBeGreaterThan(80); // 2× fire into a bulky spread
    expect(entry!.spreadLabel).toBe('Modest 32 SpA');
  });

  test('drawback moves (Giga Impact etc.) never headline when a practical move exists', () => {
    const frail = prepareDefender({
      species: 'Whimsicott',
      ability: 'Prankster',
      alignment: 'Serious',
      sp: { ...EMPTY_SP },
      moves: [],
    });
    // Invariant across a slice of the roster: if any practical option was
    // verified, the headline is practical — Hyper Beam & friends only ever
    // appear tagged in the alternatives (or headline when nothing else works).
    let sawTaggedAlternative = false;
    for (const attacker of lookup.species.slice(0, 60)) {
      const entry = sweepOne(attacker, frail, ['Grass', 'Fairy'], lookup);
      if (!entry) continue;
      const hasPractical = entry.alternatives.some((o) => !o.drawback);
      if (hasPractical) expect(entry.drawback, entry.name).toBeUndefined();
      if (entry.alternatives.some((o) => o.drawback)) sawTaggedAlternative = true;
      // Sorted descending.
      const pcts = entry.alternatives.map((o) => o.maxPercent);
      expect([...pcts].sort((a, b) => b - a)).toEqual(pcts);
      // No filler: every listed alternative is an OHKO/near-miss (headline exempt).
      for (const o of entry.alternatives) {
        if (o.move !== entry.move) {
          expect(o.maxPercent, `${entry.name} ${o.move}`).toBeGreaterThanOrEqual(85);
        }
      }
    }
    expect(sawTaggedAlternative).toBe(true); // the tagging actually fires
  });

  test('REGRESSION: ladder moves are always verified even when the heuristic crowds them out', () => {
    // Kingambit (Dark/Steel): Camerupt's 4× fighting coverage floods the
    // BP×eff shortlist, but Earth Power is what real Camerupt-Mega clicks —
    // and it OHKOs. Passing it as a must-verify move forces it into results.
    const kingambit = prepareDefender({
      species: 'Kingambit',
      ability: 'Defiant',
      alignment: 'Adamant',
      sp: { ...EMPTY_SP, hp: 32, atk: 32, spd: 2 },
      moves: [],
    });
    const camerupt = lookup.getSpecies('Camerupt-Mega')!;
    const entry = sweepOne(
      camerupt,
      kingambit,
      ['Dark', 'Steel'],
      lookup,
      {},
      ['Earth Power', 'Heat Wave', 'Eruption'],
    )!;
    expect(entry).not.toBeNull();
    const earthPower = entry.alternatives.find((o) => o.move === 'Earth Power');
    expect(earthPower).toBeDefined();
    expect(earthPower!.maxPercent).toBeGreaterThanOrEqual(100); // it OHKOs
  });

  test('bulky defender spread lowers the numbers vs 0 SP', () => {
    const camerupt = lookup.getSpecies('Camerupt-Mega')!;
    const frail = prepareDefender({ ...CORVIKNIGHT, sp: { ...EMPTY_SP } });
    const vsBulky = sweepOne(camerupt, defender, ['Flying', 'Steel'], lookup)!;
    const vsFrail = sweepOne(camerupt, frail, ['Flying', 'Steel'], lookup)!;
    expect(vsFrail.maxPercent).toBeGreaterThan(vsBulky.maxPercent);
  });
});
