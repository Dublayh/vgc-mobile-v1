/**
 * ProvenTeams (plan §4): real tournament placements that contain every
 * locked slot — the strongest possible evidence for "what goes with this
 * core". Pure; the tournament bundle is injected.
 */
import type { DexLookup } from '../../data/dex';
import { baseSpeciesName } from '../../data/formes';
import type {
  TournamentData,
  TournamentEvent,
  TournamentMon,
  TournamentTeam,
} from '../../data/tournaments';
import type { ChampionsSet } from '../../engine/types';

export interface ProvenTeam {
  event: TournamentEvent;
  placement: TournamentTeam;
  /** the placement's mons that are NOT already locked */
  others: TournamentMon[];
}

export function provenTeams(
  locked: ChampionsSet[],
  data: TournamentData,
  lookup: DexLookup,
  limit = 5,
): ProvenTeam[] {
  if (locked.length === 0) return [];
  const want = locked.map((s) => baseSpeciesName(s.species, lookup));
  const out: ProvenTeam[] = [];
  for (const event of data.events) {
    for (const placement of event.placements) {
      const bases = placement.mons.map((m) => baseSpeciesName(m.species, lookup));
      if (!want.every((w) => bases.includes(w))) continue;
      out.push({
        event,
        placement,
        others: placement.mons.filter((_, i) => !want.includes(bases[i])),
      });
    }
  }
  return out
    .sort(
      (a, b) =>
        a.placement.place - b.placement.place || b.event.date.localeCompare(a.event.date),
    )
    .slice(0, limit);
}
