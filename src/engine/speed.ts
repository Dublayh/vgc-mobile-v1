/**
 * Speed tier computation at level 50 with common modifiers.
 * All Champions battles are level 50, so every comparison lives on one ladder.
 */
import { computeStat, DEFAULT_SP_MODE, type SPRoundingMode } from './stats';
import type { AlignmentName } from './types';

export interface SpeedModifiers {
  stage?: number;          // -6..+6 (Icy Wind, Dragon Dance, ...)
  tailwind?: boolean;      // ×2
  choiceScarf?: boolean;   // ×1.5
  paralysis?: boolean;     // ×0.5 (gen 7+)
  ironBall?: boolean;      // ×0.5
  swiftSwimLike?: boolean; // Swift Swim / Chlorophyll / Sand Rush / Slush Rush / Surge Surfer / Unburden ×2
  protosynthesisLike?: boolean; // Protosynthesis / Quark Drive speed boost ×1.5
}

const stageMultiplier = (stage: number): [number, number] => {
  const s = Math.max(-6, Math.min(6, stage));
  return s >= 0 ? [2 + s, 2] : [2, 2 - s];
};

/** Final in-battle speed after stages and modifiers (Showdown order: stage first, then item/ability/field, floored at each ×). */
export function effectiveSpeed(baseSpeed50: number, mods: SpeedModifiers = {}): number {
  let speed = baseSpeed50;
  if (mods.stage) {
    const [num, den] = stageMultiplier(mods.stage);
    speed = Math.floor((speed * num) / den);
  }
  if (mods.swiftSwimLike) speed = Math.floor(speed * 2);
  if (mods.protosynthesisLike) speed = Math.floor(speed * 1.5);
  if (mods.choiceScarf) speed = Math.floor(speed * 1.5);
  if (mods.ironBall) speed = Math.floor(speed * 0.5);
  if (mods.tailwind) speed = Math.floor(speed * 2);
  if (mods.paralysis) speed = Math.floor(speed * 0.5);
  return Math.max(1, speed);
}

/** Raw level-50 speed stat for a base speed / SP / alignment combo. */
export function speedStat(
  baseSpe: number,
  sp: number,
  alignment: AlignmentName,
  mode: SPRoundingMode = DEFAULT_SP_MODE,
): number {
  return computeStat(baseSpe, sp, alignment, 'spe', mode);
}

/** Common benchmark speeds for a species: min (0 SP, −alignment) → max (32 SP, +alignment). */
export function speedRange(baseSpe: number, mode: SPRoundingMode = DEFAULT_SP_MODE) {
  return {
    min: speedStat(baseSpe, 0, 'Brave', mode),      // −Spe alignment, 0 SP
    neutral: speedStat(baseSpe, 0, 'Serious', mode),
    max: speedStat(baseSpe, 32, 'Timid', mode),     // +Spe alignment, 32 SP
  };
}
