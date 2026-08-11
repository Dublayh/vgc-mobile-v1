/**
 * Team Completer (plan §4): given locked slots, rank candidates for the next
 * slot using real teammate co-occurrence, coverage-gap patching, archetype
 * fit, and usage viability — every suggestion carries visible evidence.
 */
import type { DexLookup } from '../../data/dex';
import type { UsageLookup } from '../../data/usage';
import { computeStats } from '../../engine/stats';
import { effectiveness, type TypeName } from '../../engine/typechart';
import type { ChampionsSet } from '../../engine/types';
import { usageMonToSet } from '../meta/threatSet';
import { coverageGaps, teamCoverage, type CoverageGaps } from './coverage';

export type Archetype = 'Trick Room' | 'Rain' | 'Sun' | 'Sand' | 'Snow' | 'Tailwind';

export function detectArchetypes(
  sets: ChampionsSet[],
  lookup: DexLookup,
): Archetype[] {
  const tags = new Set<Archetype>();
  const abilities = sets.map((s) => s.ability);
  const moves = sets.flatMap((s) => s.moves.filter(Boolean).map((m) => m!.toLowerCase()));
  if (abilities.includes('Drizzle')) tags.add('Rain');
  if (abilities.includes('Drought')) tags.add('Sun');
  if (abilities.includes('Sand Stream')) tags.add('Sand');
  if (abilities.includes('Snow Warning')) tags.add('Snow');
  if (moves.includes('trick room')) tags.add('Trick Room');
  if (moves.includes('tailwind')) tags.add('Tailwind');

  // Speed profile: a majority of genuinely slow mons implies Trick Room intent.
  if (!tags.has('Trick Room') && sets.length >= 2) {
    const speeds = sets.map((s) => {
      const sp = lookup.getSpecies(s.megaStone ?? s.species);
      return sp ? computeStats(sp.baseStats, s.sp, s.alignment).spe : 100;
    });
    if (speeds.filter((v) => v <= 80).length > sets.length / 2) tags.add('Trick Room');
  }
  return [...tags];
}

export interface Suggestion {
  name: string; // forme display name
  set: ChampionsSet;
  usage: number;
  score: number;
  evidence: string[];
}

const archetypeFit = (
  tags: Archetype[],
  types: string[],
  ability: string,
  speed: number,
): { bonus: number; note?: string } => {
  for (const tag of tags) {
    switch (tag) {
      case 'Trick Room':
        if (speed <= 60) return { bonus: 0.5, note: `fits Trick Room (${speed} Spe)` };
        break;
      case 'Rain':
        if (types.includes('Water') || ability === 'Swift Swim')
          return { bonus: 0.4, note: 'fits Rain' };
        break;
      case 'Sun':
        if (types.includes('Fire') || ability === 'Chlorophyll' || ability === 'Protosynthesis')
          return { bonus: 0.4, note: 'fits Sun' };
        break;
      case 'Sand':
        if (['Rock', 'Ground', 'Steel'].some((t) => types.includes(t)) || ability === 'Sand Rush')
          return { bonus: 0.4, note: 'fits Sand' };
        break;
      case 'Snow':
        if (types.includes('Ice') || ability === 'Slush Rush') return { bonus: 0.4, note: 'fits Snow' };
        break;
      case 'Tailwind':
        break; // tailwind teams like fast frail attackers; usage already favors them
    }
  }
  return { bonus: 0 };
};

export function suggestPartners(
  locked: ChampionsSet[],
  usage: UsageLookup,
  lookup: DexLookup,
  opts: { limit?: number } = {},
): { suggestions: Suggestion[]; gaps: CoverageGaps; archetypes: Archetype[] } {
  const getMove = (name: string) => lookup.getMove(name);
  const getTyping = (set: ChampionsSet) => lookup.getSpecies(set.megaStone ?? set.species);
  const cov = teamCoverage(locked, getMove, getTyping);
  const gaps = coverageGaps(cov);
  const archetypes = detectArchetypes(locked, lookup);

  const lockedSpecies = new Set(locked.map((s) => s.species));
  const lockedItems = new Set(locked.flatMap((s) => (s.item ? [s.item] : [])));
  const lockedFormeNames = locked.map((s) => s.megaStone ?? s.species);
  const teamHasMega = locked.some((s) => s.megaStone);

  const suggestions: Suggestion[] = [];
  for (const mon of usage.mons) {
    const species = lookup.getSpecies(mon.name);
    if (!species) continue;
    const baseName = species.baseSpecies ?? species.name;
    if (lockedSpecies.has(baseName)) continue; // species clause

    const set = usageMonToSet(mon, lookup);
    if (!set) continue;

    const evidence: string[] = [];
    let score = mon.usage * 1.2;

    // Teammate co-occurrence with every locked slot (the statistical core).
    let partnerShare = 0;
    for (const lockedName of lockedFormeNames) {
      const lockedMon = usage.get(lockedName);
      const share = lockedMon?.teammates.find(
        ([name]) => name === mon.name || name === baseName,
      )?.[1];
      if (share) {
        partnerShare += share;
        evidence.push(`pairs with ${lockedName} (${Math.round(share * 100)}%)`);
      }
    }
    score += partnerShare * 2.5;

    // Coverage patching: SE hits into currently-uncovered types.
    const moveTypes = new Set(
      set.moves
        .filter((m): m is string => !!m)
        .map((m) => lookup.getMove(m))
        .filter((m) => m && m.category !== 'Status')
        .map((m) => m!.type),
    );
    const covers = gaps.uncovered.filter((t) =>
      [...moveTypes].some((mt) => effectiveness(mt, [t]) >= 2),
    );
    if (covers.length) {
      score += Math.min(covers.length, 3) * 0.25;
      evidence.push(`covers ${covers.slice(0, 3).join(', ')}`);
    }

    // Defensive patching: resists the types the team is stacked weak to.
    const resists = gaps.weakTo.filter((t) => effectiveness(t, species.types) < 1);
    if (resists.length) {
      score += resists.length * 0.3;
      evidence.push(`resists ${resists.join(', ')} (team weak)`);
    }

    // Archetype fit.
    const speed = computeStats(species.baseStats, set.sp, set.alignment).spe;
    const fit = archetypeFit(archetypes, species.types, set.ability, speed);
    score += fit.bonus;
    if (fit.note) evidence.push(fit.note);

    // Clause frictions (soft): flag rather than exclude.
    if (set.item && lockedItems.has(set.item)) {
      score -= 0.15;
      evidence.push(`item clash: ${set.item}`);
    }
    if (set.megaStone && teamHasMega) {
      score -= 0.2;
      evidence.push('second mega');
    }

    suggestions.push({ name: mon.name, set, usage: mon.usage, score, evidence });
  }

  suggestions.sort((a, b) => b.score - a.score);
  return { suggestions: suggestions.slice(0, opts.limit ?? 8), gaps, archetypes };
}

/** Coverage summary shape for direct display (types as ordered entries). */
export type { CoverageGaps, TypeName };
