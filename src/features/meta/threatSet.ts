import type { DexLookup } from '../../data/dex';
import type { UsageMon } from '../../data/usage';
import { EMPTY_SP, type AlignmentName, type ChampionsSet } from '../../engine/types';

/** Materialize a usage-stats entry into its most common set. */
export function usageMonToSet(mon: UsageMon, lookup: DexLookup): ChampionsSet | null {
  const species = lookup.getSpecies(mon.name);
  if (!species) return null;

  const spread = mon.spreads[0];
  const topItem = mon.items[0]?.[0];
  const moves = mon.moves.slice(0, 4).map(([name]) => name) as ChampionsSet['moves'];

  return {
    species: species.baseSpecies ?? species.name,
    ...(species.baseSpecies ? { megaStone: species.name } : {}),
    ability: mon.abilities[0]?.[0] ?? species.abilities[0] ?? '',
    ...(topItem && topItem !== 'Nothing' ? { item: topItem } : {}),
    alignment: (spread?.alignment ?? 'Serious') as AlignmentName,
    sp: spread ? { ...spread.sp } : { ...EMPTY_SP },
    moves,
  };
}
