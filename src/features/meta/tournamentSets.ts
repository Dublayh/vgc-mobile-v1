/** Tournament placement → ChampionsSets (megas inferred from held stones). */
import type { DexLookup } from '../../data/dex';
import { baseSpeciesOf, formeSet } from '../../data/formes';
import type { TournamentMon, TournamentTeam } from '../../data/tournaments';
import { ALIGNMENTS, type AlignmentName, type ChampionsSet } from '../../engine/types';
import { parsePaste } from '../import-export/showdown';

export function tournamentMonToSet(m: TournamentMon, lookup: DexLookup): ChampionsSet | null {
  const sp = lookup.getSpecies(m.species);
  if (!sp) return null;
  const base = baseSpeciesOf(sp, lookup);

  // Sources (Limitless) list megas as base species holding the stone —
  // the stone pins the exact forme, so mark the set as that mega.
  let megaForme = sp.baseSpecies ? sp.name : undefined;
  if (!megaForme && m.item) {
    const stone = lookup.getItem(m.item);
    if (stone?.megaForme && (lookup.megaBaseOf(stone.megaForme) ?? stone.megaEvolves) === base) {
      megaForme = lookup.getSpecies(stone.megaForme)?.name;
    }
  }

  return formeSet(sp, lookup, {
    ...(megaForme ? { megaStone: megaForme } : {}),
    ability: m.ability ?? sp.abilities[0] ?? '',
    item: megaForme ? (lookup.stoneFor(megaForme)?.name ?? m.item) : m.item,
    alignment:
      m.alignment && m.alignment in ALIGNMENTS ? (m.alignment as AlignmentName) : 'Serious',
    moves: (m.moves ?? []).slice(0, 4) as ChampionsSet['moves'],
  });
}

export function placementToSets(t: TournamentTeam, lookup: DexLookup): ChampionsSet[] {
  if (t.paste) {
    try {
      return parsePaste(t.paste).slice(0, 6);
    } catch {
      /* fall through to structured mons */
    }
  }
  return t.mons
    .slice(0, 6)
    .map((m) => tournamentMonToSet(m, lookup))
    .filter((s): s is ChampionsSet => !!s);
}
