/**
 * Forme ↔ base-species resolution, regulation-authoritative. A mega forme's
 * roster-legal base is NOT always `species.baseSpecies` (Floette-Mega's base
 * is Floette-Eternal), so every place that turns a forme into a set goes
 * through here.
 */
import type { DexLookup, DexSpecies } from './dex';
import { EMPTY_SP, type ChampionsSet } from '../engine/types';

export function baseSpeciesOf(sp: DexSpecies, lookup: DexLookup): string {
  return sp.baseSpecies ? (lookup.megaBaseOf(sp.name) ?? sp.baseSpecies) : sp.name;
}

export function baseSpeciesName(name: string, lookup: DexLookup): string {
  const sp = lookup.getSpecies(name);
  return sp ? baseSpeciesOf(sp, lookup) : name;
}

/** Any dex species (or mega forme) as a neutral 0-SP set, with optional overrides. */
export function formeSet(
  sp: DexSpecies,
  lookup: DexLookup,
  partial: Partial<ChampionsSet> = {},
): ChampionsSet {
  return {
    species: baseSpeciesOf(sp, lookup),
    ...(sp.baseSpecies ? { megaStone: sp.name } : {}),
    ability: sp.abilities[0] ?? '',
    alignment: 'Serious',
    sp: { ...EMPTY_SP },
    moves: [],
    ...partial,
  };
}
