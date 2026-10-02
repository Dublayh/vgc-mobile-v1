/**
 * Team Completer (plan §4): given locked slots, rank candidates for the next
 * slot. Two pure stages:
 *
 *  1. suggestPartners — statistical ranking: real teammate co-occurrence
 *     (both directions), META-WEIGHTED coverage patching (a type only counts
 *     for as much of the ladder as actually carries it), defensive patching,
 *     role gaps (Fake Out / speed control / redirection / Intimidate),
 *     archetype fit and clause frictions. Fit is multiplied by a usage prior
 *     so a 0.3% mon can't out-rank a staple by stacking tiny bonuses, and
 *     the list is deduped to one row per species.
 *  2. auditSuggestion — calc-backed evidence: audits a candidate against the
 *     team's worst meta matchups and rewards the ones that actually beat
 *     them. Every line can be reproduced in CalcView.
 */
import type { DexLookup } from '../../data/dex';
import type { UsageLookup, UsageMon } from '../../data/usage';
import { computeStats } from '../../engine/stats';
import { auditMatchup, type AuditContext } from '../../engine/threat';
import { effectiveness, TYPES, type TypeName } from '../../engine/typechart';
import type { ChampionsSet } from '../../engine/types';
import { usageMonToSet } from '../meta/threatSet';
import { coverageGaps, teamCoverage, type CoverageGaps } from './coverage';

export type Archetype = 'Trick Room' | 'Rain' | 'Sun' | 'Sand' | 'Snow' | 'Tailwind';

export function detectArchetypes(sets: ChampionsSet[], lookup: DexLookup): Archetype[] {
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

/* ------------------------------------------------------------------ roles */

export type Role = 'Fake Out' | 'speed control' | 'redirection' | 'Intimidate';

const SPEED_CONTROL = new Set(['tailwind', 'trick room', 'icy wind', 'electroweb']);
const REDIRECTION = new Set(['follow me', 'rage powder']);
const WEATHER: Record<string, string> = {
  Drizzle: 'rain',
  Drought: 'sun',
  'Sand Stream': 'sand',
  'Snow Warning': 'snow',
};
const TERRAIN: Record<string, string> = {
  'Grassy Surge': 'grassy',
  'Electric Surge': 'electric',
  'Psychic Surge': 'psychic',
  'Misty Surge': 'misty',
};

/** Roles a single set fills, from its moves and ability. */
export function rolesOf(set: ChampionsSet): Role[] {
  const moves = set.moves.filter(Boolean).map((m) => m!.toLowerCase());
  const roles: Role[] = [];
  if (moves.includes('fake out')) roles.push('Fake Out');
  if (moves.some((m) => SPEED_CONTROL.has(m))) roles.push('speed control');
  if (moves.some((m) => REDIRECTION.has(m))) roles.push('redirection');
  if (set.ability === 'Intimidate') roles.push('Intimidate');
  return roles;
}

export const teamRoles = (sets: ChampionsSet[]): Set<Role> =>
  new Set(sets.flatMap(rolesOf));

/* ------------------------------------------------------------ meta weights */

export interface MetaWeights {
  /** how much of the ladder (by usage) each DEFENDING type represents, max = 1 */
  defending: Record<TypeName, number>;
  /** how much of the ladder's ATTACKING moves each type represents, max = 1 */
  attacking: Record<TypeName, number>;
}

const zeroTypes = (): Record<TypeName, number> =>
  Object.fromEntries(TYPES.map((t) => [t, 0])) as Record<TypeName, number>;

const normalizeMax = (rec: Record<TypeName, number>) => {
  const max = Math.max(...Object.values(rec), 1e-9);
  for (const t of TYPES) rec[t] /= max;
  return rec;
};

/** Type prevalence across the top of the ladder, usage-weighted. */
export function metaWeights(usage: UsageLookup, lookup: DexLookup, top = 60): MetaWeights {
  const defending = zeroTypes();
  const attacking = zeroTypes();
  for (const mon of usage.top(top)) {
    const sp = lookup.getSpecies(mon.name);
    if (!sp) continue;
    for (const t of sp.types) defending[t as TypeName] += mon.usage;
    for (const [name, share] of mon.moves) {
      const mv = lookup.getMove(name);
      if (mv && mv.category !== 'Status') attacking[mv.type as TypeName] += mon.usage * share;
    }
  }
  return { defending: normalizeMax(defending), attacking: normalizeMax(attacking) };
}

/* -------------------------------------------------------------- suggest */

export interface ThreatRef {
  name: string;
  set: ChampionsSet;
  usage: number;
  /** evidence weight (default 0.5 + usage); user-chosen targets pass a flat 1.5 */
  weight?: number;
}

export type Verdict = 'safe' | 'shaky' | 'loses';

export interface Suggestion {
  name: string; // forme display name
  /** roster-legal base species (one suggestion per base) */
  base: string;
  set: ChampionsSet;
  usage: number;
  /** synergy/fit multiplier before the usage prior (1 = no evidence) */
  fit: number;
  /** fit × usagePrior(usage) — the ranking key */
  score: number;
  evidence: string[];
  /** calc-backed matchup evidence (set by auditSuggestion) */
  audit?: {
    beats: string[];
    losesTo: string[];
    shaky: string[];
    /** per-threat verdict in the order audited (mirror matchups omitted) */
    verdicts: { name: string; verdict: Verdict }[];
  };
}

export interface CompleterAnalysis {
  suggestions: Suggestion[];
  gaps: CoverageGaps;
  archetypes: Archetype[];
  roles: Set<Role>;
  weights: MetaWeights;
}

/**
 * Usage prior: fit × log(1 + min(usage, 8%)/2%). Its job is to keep fringe
 * picks out (1% → 0.4, 0.5% → 0.2), NOT to rank viable mons by popularity:
 * everything at or above 8% shares the cap (1.6), so among proven picks the
 * synergy evidence decides. Without the cap a 46% staple with no pairing
 * out-ranked a 4% mon that sits on 79% of the core's real teams.
 */
export const usagePrior = (usage: number): number => Math.log1p(Math.min(usage, 0.08) / 0.02);
/** Mons below this ladder share are not "proven picks" and are skipped. */
const MIN_USAGE = 0.005;

const WEIGHTS = {
  partner: 2, // × summed co-occurrence (0..1 per locked slot)
  coverage: 0.5, // × meta-weighted uncovered types patched (cap 1)
  resist: 0.5, // × meta-weighted stacked weaknesses resisted (cap 1)
  role: { 'Fake Out': 0.3, 'speed control': 0.3, redirection: 0.15, Intimidate: 0.2 } as Record<
    Role,
    number
  >,
  archetype: { tr: 0.5, weather: 0.4 },
  itemClash: -0.15,
  secondMega: -0.2,
  setterConflict: -0.3,
  setterDuplicate: -0.15,
};

const archetypeFit = (
  tags: Archetype[],
  types: string[],
  ability: string,
  speed: number,
): { bonus: number; note?: string } => {
  for (const tag of tags) {
    switch (tag) {
      case 'Trick Room':
        if (speed <= 60) return { bonus: WEIGHTS.archetype.tr, note: `fits Trick Room (${speed} Spe)` };
        break;
      case 'Rain':
        if (types.includes('Water') || ability === 'Swift Swim')
          return { bonus: WEIGHTS.archetype.weather, note: 'fits Rain' };
        break;
      case 'Sun':
        if (types.includes('Fire') || ability === 'Chlorophyll' || ability === 'Protosynthesis')
          return { bonus: WEIGHTS.archetype.weather, note: 'fits Sun' };
        break;
      case 'Sand':
        if (['Rock', 'Ground', 'Steel'].some((t) => types.includes(t)) || ability === 'Sand Rush')
          return { bonus: WEIGHTS.archetype.weather, note: 'fits Sand' };
        break;
      case 'Snow':
        if (types.includes('Ice') || ability === 'Slush Rush')
          return { bonus: WEIGHTS.archetype.weather, note: 'fits Snow' };
        break;
      case 'Tailwind':
        break; // tailwind teams like fast frail attackers; usage already favors them
    }
  }
  return { bonus: 0 };
};

const pctOf = (v: number) => `${Math.round(v * 100)}%`;

/** Co-occurrence between a locked forme and a candidate, from EITHER mon's teammate list. */
function coOccurrence(locked: UsageMon | undefined, candidate: UsageMon, lockedName: string): number {
  const forward = locked?.teammates.find(([n]) => n === candidate.name)?.[1] ?? 0;
  const lockedBase = lockedName.replace(/-Mega(-[XYZ])?$/, '');
  const backward =
    candidate.teammates.find(([n]) => n === lockedName || n === lockedBase)?.[1] ?? 0;
  return Math.max(forward, backward);
}

export function suggestPartners(
  locked: ChampionsSet[],
  usage: UsageLookup,
  lookup: DexLookup,
  opts: { limit?: number } = {},
): CompleterAnalysis {
  const getTyping = (set: ChampionsSet) => lookup.getSpecies(set.megaStone ?? set.species);
  const cov = teamCoverage(locked, (n) => lookup.getMove(n), getTyping);
  const gaps = coverageGaps(cov);
  const archetypes = detectArchetypes(locked, lookup);
  const roles = teamRoles(locked);
  const weights = metaWeights(usage, lookup);

  const lockedBases = new Set(
    locked.map((s) => lookup.getSpecies(s.species)?.name ?? s.species),
  );
  const lockedItems = new Set(locked.flatMap((s) => (s.item ? [s.item] : [])));
  const lockedFormeNames = locked.map((s) => s.megaStone ?? s.species);
  const teamHasMega = locked.some((s) => s.megaStone);
  const teamWeather = locked.map((s) => WEATHER[s.ability]).find(Boolean);
  const teamTerrain = locked.map((s) => TERRAIN[s.ability]).find(Boolean);

  const byBase = new Map<string, Suggestion>();
  for (const mon of usage.mons) {
    if (mon.usage < MIN_USAGE) continue;
    const species = lookup.getSpecies(mon.name);
    if (!species) continue;
    const set = usageMonToSet(mon, lookup);
    if (!set) continue;
    const base = set.species;
    if (lockedBases.has(base)) continue; // species clause

    const evidence: string[] = [];
    let fit = 1;

    // Teammate co-occurrence with every locked slot (the statistical core).
    for (const lockedName of lockedFormeNames) {
      const share = coOccurrence(usage.get(lockedName), mon, lockedName);
      if (share >= 0.05) {
        fit += share * WEIGHTS.partner;
        evidence.push(`on ${pctOf(share)} of ${lockedName} teams`);
      }
    }

    // Coverage patching, weighted by how much of the meta each type is.
    const moveTypes = new Set(
      set.moves
        .filter((m): m is string => !!m)
        .map((m) => lookup.getMove(m))
        .filter((m) => m && m.category !== 'Status')
        .map((m) => m!.type),
    );
    const covers = gaps.uncovered
      .filter((t) => [...moveTypes].some((mt) => effectiveness(mt, [t]) >= 2))
      .map((t) => [t, weights.defending[t]] as const)
      .filter(([, w]) => w >= 0.1)
      .sort((a, b) => b[1] - a[1]);
    if (covers.length) {
      fit += Math.min(1, covers.reduce((s, [, w]) => s + w, 0)) * WEIGHTS.coverage;
      evidence.push(`covers ${covers.slice(0, 3).map(([t]) => t).join(', ')}`);
    }

    // Defensive patching: resists the types the team is stacked weak to,
    // weighted by how common those attacks are on the ladder.
    const resists = gaps.weakTo
      .filter((t) => effectiveness(t, species.types) < 1)
      .map((t) => [t, weights.attacking[t]] as const)
      .filter(([, w]) => w >= 0.1)
      .sort((a, b) => b[1] - a[1]);
    if (resists.length) {
      fit += Math.min(1, resists.reduce((s, [, w]) => s + w, 0)) * WEIGHTS.resist;
      evidence.push(`resists ${resists.map(([t]) => t).join(', ')} (team weak)`);
    }

    // Role gaps.
    for (const role of rolesOf(set)) {
      if (!roles.has(role)) {
        fit += WEIGHTS.role[role];
        evidence.push(`adds ${role}`);
      }
    }
    const weather = WEATHER[set.ability];
    if (weather && teamWeather) {
      const same = weather === teamWeather;
      fit += same ? WEIGHTS.setterDuplicate : WEIGHTS.setterConflict;
      evidence.push(same ? `second ${weather} setter` : `${weather} conflicts with ${teamWeather}`);
    }
    const terrain = TERRAIN[set.ability];
    if (terrain && teamTerrain) {
      const same = terrain === teamTerrain;
      fit += same ? WEIGHTS.setterDuplicate : WEIGHTS.setterConflict;
      evidence.push(
        same ? `second ${terrain} terrain setter` : `${terrain} terrain conflicts with ${teamTerrain}`,
      );
    }

    // Archetype fit.
    const speed = computeStats(species.baseStats, set.sp, set.alignment).spe;
    const af = archetypeFit(archetypes, species.types, set.ability, speed);
    fit += af.bonus;
    if (af.note) evidence.push(af.note);

    // Clause frictions (soft): flag rather than exclude.
    if (set.item && lockedItems.has(set.item)) {
      fit += WEIGHTS.itemClash;
      evidence.push(`item clash: ${set.item}`);
    }
    if (set.megaStone && teamHasMega) {
      fit += WEIGHTS.secondMega;
      evidence.push('second mega');
    }

    const candidate: Suggestion = {
      name: mon.name,
      base,
      set,
      usage: mon.usage,
      fit,
      score: fit * usagePrior(mon.usage),
      evidence,
    };
    const prev = byBase.get(base);
    if (!prev || candidate.score > prev.score) byBase.set(base, candidate);
  }

  const suggestions = [...byBase.values()].sort((a, b) => b.score - a.score);
  return { suggestions: suggestions.slice(0, opts.limit ?? 8), gaps, archetypes, roles, weights };
}

/* ---------------------------------------------------------------- audit */

export interface AuditWeights {
  /** fit delta per clean win, × threat weight */
  safe: number;
  /** fit delta per outright loss, × threat weight */
  loses: number;
  /** total delta clamp */
  min: number;
  max: number;
}

/** Default: the team's worst matchups (weighted 0.5..1.5 by usage), clamped to [-1, +1.5]. */
export const WORST_AUDIT: AuditWeights = { safe: 0.25, loses: -0.15, min: -1, max: 1.5 };
/** User-chosen "cover these" targets: covering the picks is the whole point. */
export const TARGET_AUDIT: AuditWeights = { safe: 0.5, loses: -0.3, min: -3, max: 6 };

/**
 * Calc-backed re-score: audit the candidate's set against a threat list
 * (the team's worst meta matchups, or the user's chosen targets). A clean
 * win ("safe") earns fit, losing outright costs it. Pure and synchronous —
 * callers chunk over candidates to keep the UI responsive.
 */
export function auditSuggestion(
  s: Suggestion,
  threats: ThreatRef[],
  ctx: AuditContext = {},
  weights: AuditWeights = WORST_AUDIT,
): Suggestion {
  const beats: string[] = [];
  const losesTo: string[] = [];
  const shaky: string[] = [];
  const verdicts: { name: string; verdict: Verdict }[] = [];
  let delta = 0;
  for (const t of threats) {
    if (t.set.species === s.set.species) continue; // mirror — not evidence
    try {
      const a = auditMatchup(s.set, t.set, ctx);
      const w = t.weight ?? 0.5 + t.usage; // 0.5..1.5
      verdicts.push({ name: t.name, verdict: a.verdict });
      if (a.verdict === 'safe') {
        beats.push(t.name);
        delta += weights.safe * w;
      } else if (a.verdict === 'loses') {
        losesTo.push(t.name);
        delta += weights.loses * w;
      } else {
        shaky.push(t.name);
      }
    } catch {
      /* species/moves outside calc data — no evidence either way */
    }
  }
  const evidence = s.evidence.filter((e) => !e.startsWith('beats ') && !e.startsWith('loses to '));
  const list = (names: string[]) =>
    names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3}` : names.join(', ');
  if (beats.length) evidence.push(`beats ${list(beats)}`);
  if (losesTo.length) evidence.push(`loses to ${list(losesTo)}`);
  const fit = s.fit + Math.max(weights.min, Math.min(weights.max, delta));
  return {
    ...s,
    fit,
    score: fit * usagePrior(s.usage),
    evidence,
    audit: { beats, losesTo, shaky, verdicts },
  };
}

export type { CoverageGaps, TypeName };
