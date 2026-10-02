/**
 * One-tap "calc against this mon" from anywhere a species appears
 * (dex detail, usage detail, threat header). Seeds the calc side with the
 * mon's most common ladder set when usage data exists, else a 0-SP baseline.
 */
import { useUI } from '../../app/store';
import type { DexLookup, DexSpecies } from '../../data/dex';
import { formeSet } from '../../data/formes';
import type { UsageLookup } from '../../data/usage';
import { useUsage } from '../../data/useUsage';
import { usageMonToSet } from '../meta/threatSet';
import { useCalc, type CalcSelection } from './calcStore';

/** The ONE way a dex species becomes a calc participant: meta set, else 0-SP. */
export function seedSelection(
  sp: DexSpecies,
  usage: UsageLookup | null | undefined,
  lookup: DexLookup,
): CalcSelection {
  const mon = usage?.get(sp.name);
  const set = (mon && usageMonToSet(mon, lookup)) || formeSet(sp, lookup);
  return { set, sourceLabel: mon ? 'meta set' : 'no usage data', fromTeam: false };
}

export function useJumpToCalc(lookup: DexLookup) {
  const usage = useUsage();
  const calc = useCalc();
  const { openCalc } = useUI();

  return (speciesName: string, role: 'attacker' | 'defender' = 'defender') => {
    const sp = lookup.getSpecies(speciesName);
    if (!sp) return;
    calc.patch({ [role]: seedSelection(sp, usage, lookup), customMove: null, expandedMove: null });
    openCalc('matchup');
  };
}
