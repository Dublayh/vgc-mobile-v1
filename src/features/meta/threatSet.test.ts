import { describe, expect, test } from 'vitest';
import { DexLookup, type RegulationData } from '../../data/dex';
import type { UsageData } from '../../data/usage';
import { setViolations } from '../../engine/legality';
import { usageMonToSet } from './threatSet';
import dexJson from '../../../public/data/dex.json';
import regJson from '../../../public/data/regulations/m-b.json';
import usageJson from '../../../public/data/usage/m-b.json';

const lookup = new DexLookup(
  dexJson as unknown as ConstructorParameters<typeof DexLookup>[0],
  regJson as unknown as RegulationData,
);
const usage = usageJson as unknown as UsageData;

describe('usageMonToSet legality (real ladder data)', () => {
  test('every materialized meta set is violation-free — megas included', () => {
    // These sets are what the completer "+ Add"s and what audits/counters run.
    // A false positive here (e.g. "Charizard cannot have Drought" because the
    // ability check ignored the mega forme) breaks the whole advisor UX.
    const ctx = lookup.legalityContext();
    let checked = 0;
    for (const mon of usage.mons) {
      const set = usageMonToSet(mon, lookup);
      if (!set) continue;
      checked++;
      const v = setViolations(set, ctx);
      expect(v, `${mon.name}: ${v.map((x) => x.message).join('; ')}`).toEqual([]);
    }
    expect(checked).toBeGreaterThan(100);
  });
});
