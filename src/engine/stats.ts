import {
  ALIGNMENTS,
  type AlignmentName,
  CHAMPIONS_LEVEL,
  FIXED_IV,
  SP_POOL,
  SP_STAT_MAX,
  type SPSpread,
  STAT_IDS,
  type StatID,
  type StatsTable,
} from './types';

/**
 * Rounding-order question (plan §7.1): community consensus is "1 SP = exactly +1
 * final stat", which means SP is added AFTER the alignment multiplier. That is the
 * default here. 'sp-before-alignment' treats SP like the EV term inside the classic
 * formula (SP added before the ×0.9/×1.1, then floored) so the two models can be
 * diffed against verified in-game values in the golden tests before M1 sign-off.
 */
export type SPRoundingMode = 'sp-after-alignment' | 'sp-before-alignment';

export const DEFAULT_SP_MODE: SPRoundingMode = 'sp-after-alignment';

const alignmentMod = (alignment: AlignmentName, stat: StatID): number => {
  const a = ALIGNMENTS[alignment];
  if (stat === 'hp') return 1;
  if (a.plus === stat) return 1.1;
  if (a.minus === stat) return 0.9;
  return 1;
};

/** The level-50, IV-31 base term shared by both formulas: floor((2·Base + 31) · 50/100). */
const baseTerm = (base: number): number =>
  Math.floor(((2 * base + FIXED_IV) * CHAMPIONS_LEVEL) / 100);

/** Final HP at level 50: baseTerm + 50 + 10 + SP. (Shedinja is always 1.) */
export function computeHP(base: number, sp: number): number {
  if (base === 1) return 1; // Shedinja
  return baseTerm(base) + CHAMPIONS_LEVEL + 10 + sp;
}

/** Final non-HP stat at level 50 under the given rounding model. */
export function computeStat(
  base: number,
  sp: number,
  alignment: AlignmentName,
  stat: Exclude<StatID, 'hp'>,
  mode: SPRoundingMode = DEFAULT_SP_MODE,
): number {
  const mod = alignmentMod(alignment, stat);
  if (mode === 'sp-after-alignment') {
    return Math.floor((baseTerm(base) + 5) * mod) + sp;
  }
  return Math.floor((baseTerm(base) + 5 + sp) * mod);
}

/** All six final stats for a set. */
export function computeStats(
  baseStats: StatsTable,
  sp: SPSpread,
  alignment: AlignmentName,
  mode: SPRoundingMode = DEFAULT_SP_MODE,
): StatsTable {
  return {
    hp: computeHP(baseStats.hp, sp.hp),
    atk: computeStat(baseStats.atk, sp.atk, alignment, 'atk', mode),
    def: computeStat(baseStats.def, sp.def, alignment, 'def', mode),
    spa: computeStat(baseStats.spa, sp.spa, alignment, 'spa', mode),
    spd: computeStat(baseStats.spd, sp.spd, alignment, 'spd', mode),
    spe: computeStat(baseStats.spe, sp.spe, alignment, 'spe', mode),
  };
}

// ---------------------------------------------------------------------------
// SP validation
// ---------------------------------------------------------------------------

export interface SPValidation {
  valid: boolean;
  total: number;
  remaining: number;
  errors: string[];
}

export function validateSP(sp: SPSpread): SPValidation {
  const errors: string[] = [];
  let total = 0;
  for (const stat of STAT_IDS) {
    const v = sp[stat];
    if (!Number.isInteger(v)) errors.push(`${stat}: SP must be an integer (got ${v})`);
    if (v < 0) errors.push(`${stat}: SP cannot be negative`);
    if (v > SP_STAT_MAX) errors.push(`${stat}: SP exceeds per-stat max of ${SP_STAT_MAX}`);
    total += v;
  }
  if (total > SP_POOL) errors.push(`total SP ${total} exceeds pool of ${SP_POOL}`);
  return { valid: errors.length === 0, total, remaining: Math.max(0, SP_POOL - total), errors };
}

/**
 * Nearest legal SP spread for an EV spread (Showdown paste import).
 * 1 SP ≈ 8 EVs; clamps to the per-stat max, then trims lowest-value leftovers
 * if the pool is exceeded (rounds each stat, then drops from the largest
 * rounding-gain first so the result stays closest to the source spread).
 */
export function evsToNearestSP(evs: StatsTable): SPSpread {
  const raw = STAT_IDS.map((stat) => ({
    stat,
    sp: Math.min(SP_STAT_MAX, Math.round(evs[stat] / 8)),
  }));
  let total = raw.reduce((sum, r) => sum + r.sp, 0);
  if (total > SP_POOL) {
    // Trim overflow from stats whose rounding gained the most (least real value lost).
    const byGain = [...raw].sort(
      (a, b) => (b.sp - evs[b.stat] / 8) - (a.sp - evs[a.stat] / 8),
    );
    let i = 0;
    while (total > SP_POOL) {
      const r = byGain[i % byGain.length];
      if (r.sp > 0) {
        r.sp--;
        total--;
      }
      i++;
    }
  }
  const out = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  for (const r of raw) out[r.stat] = r.sp;
  return out;
}

/** SP → EV export for interop with mainline calc sites (1 SP = 8 EVs, capped at 252). */
export function spToEVs(sp: SPSpread): StatsTable {
  const out = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  for (const stat of STAT_IDS) out[stat] = Math.min(252, sp[stat] * 8);
  return out;
}
