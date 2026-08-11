/**
 * SP spread optimizers. The 66-point pool with a 0–32 range per stat makes
 * brute force trivial (33 values per stat), so these are exact searches,
 * not heuristics.
 */
import { Field, type Pokemon } from '@smogon/calc';
import { buildField, runCalc, toCalcPokemon, type FieldOptions } from './calc';
import { DEFAULT_SP_MODE, type SPRoundingMode, validateSP } from './stats';
import { SP_STAT_MAX, type ChampionsSet, type StatID } from './types';

export interface SurvivalTarget {
  attacker: Pokemon;
  moveName: string;
  field?: Field;
  /** Number of hits to survive (default 1). */
  hits?: number;
}

/**
 * Minimum SP in `stat` (typically 'hp', 'def' or 'spd') such that `defenderSet`
 * survives the attack. Returns null if even 32 SP is not enough.
 * Only the single stat is varied; the rest of the spread is kept as-is.
 */
export function minSPToSurvive(
  defenderSet: ChampionsSet,
  stat: StatID,
  target: SurvivalTarget,
  spMode: SPRoundingMode = DEFAULT_SP_MODE,
): number | null {
  const field = target.field ?? buildField();
  for (let sp = 0; sp <= SP_STAT_MAX; sp++) {
    const candidate: ChampionsSet = { ...defenderSet, sp: { ...defenderSet.sp, [stat]: sp } };
    if (!validateSP(candidate.sp).valid) return null; // pool exhausted
    const defender = toCalcPokemon(candidate, { spMode });
    const result = runCalc(target.attacker, defender, target.moveName, field);
    const maxDamage = Math.max(0, ...result.rolls) * (target.hits ?? 1);
    if (maxDamage < defender.maxHP()) return sp;
  }
  return null;
}

/**
 * Minimum SP in Speed to reach at least `targetSpeed` (e.g. "outspeed max-speed
 * Garchomp" = its max speed + 1). Returns null if unreachable within 32 SP/pool.
 */
export function minSPToReachSpeed(
  set: ChampionsSet,
  targetSpeed: number,
  computeSpe: (spSpe: number) => number,
): number | null {
  for (let sp = 0; sp <= SP_STAT_MAX; sp++) {
    if (!validateSP({ ...set.sp, spe: sp }).valid) return null;
    if (computeSpe(sp) >= targetSpeed) return sp;
  }
  return null;
}

export interface MaxDamageQuery {
  attackerSet: ChampionsSet;
  defenderSet: ChampionsSet;
  moveName: string;
  offenseStat: 'atk' | 'spa';
  fieldOpts?: FieldOptions;
  spMode?: SPRoundingMode;
}

/** Max-roll damage % for each SP investment 0–32 in the offense stat (for charting/optimizing). */
export function damageCurve(q: MaxDamageQuery): { sp: number; maxPercent: number }[] {
  const field = buildField(q.fieldOpts);
  const defender = toCalcPokemon(q.defenderSet, { spMode: q.spMode });
  const out: { sp: number; maxPercent: number }[] = [];
  for (let sp = 0; sp <= SP_STAT_MAX; sp++) {
    const candidate: ChampionsSet = {
      ...q.attackerSet,
      sp: { ...q.attackerSet.sp, [q.offenseStat]: sp },
    };
    if (!validateSP(candidate.sp).valid) break;
    const attacker = toCalcPokemon(candidate, { spMode: q.spMode });
    const result = runCalc(attacker, defender, q.moveName, field);
    out.push({ sp, maxPercent: result.maxPercent });
  }
  return out;
}
