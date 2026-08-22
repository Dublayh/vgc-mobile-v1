/**
 * One-tap "calc against this mon" from anywhere a species appears
 * (dex detail, usage detail, threat header). Seeds the calc side with the
 * mon's most common ladder set when usage data exists, else a 0-SP baseline.
 */
import { useUI } from '../../app/store';
import type { DexLookup, DexSpecies } from '../../data/dex';
import { useUsage } from '../../data/useUsage';
import { EMPTY_SP, type ChampionsSet } from '../../engine/types';
import { usageMonToSet } from '../meta/threatSet';
import { useCalc, type CalcSelection } from './calcStore';

/** Any dex species (or mega forme) as a neutral 0-SP set. */
export function speciesToSet(sp: DexSpecies, lookup?: DexLookup): ChampionsSet {
  // Roster-legal base for megas (Floette-Mega → Floette-Eternal).
  const base = sp.baseSpecies
    ? (lookup?.megaBaseOf(sp.name) ?? sp.baseSpecies)
    : sp.name;
  return {
    species: base,
    ...(sp.baseSpecies ? { megaStone: sp.name } : {}),
    ability: sp.abilities[0] ?? '',
    alignment: 'Serious',
    sp: { ...EMPTY_SP },
    moves: [],
  };
}

export function useJumpToCalc(lookup: DexLookup) {
  const usage = useUsage();
  const calc = useCalc();
  const { setTab } = useUI();

  return (speciesName: string, role: 'attacker' | 'defender' = 'defender') => {
    const sp = lookup.getSpecies(speciesName);
    if (!sp) return;
    const mon = usage?.get(sp.name);
    const set = (mon && usageMonToSet(mon, lookup)) || speciesToSet(sp, lookup);
    const selection: CalcSelection = {
      set,
      sourceLabel: mon ? 'meta set' : 'no usage data',
      fromTeam: false,
    };
    calc.patch({ [role]: selection, customMove: null, expandedMove: null });
    setTab('calc');
  };
}
