/**
 * Team type-coverage analysis (plan §4 TeamAnalysis/GapFiller).
 * Pure: move/type resolution is injected so this stays unit-testable.
 */
import { effectiveness, TYPES, type TypeName } from '../../engine/typechart';
import type { ChampionsSet } from '../../engine/types';

export interface MoveInfo {
  type: string;
  category: 'Physical' | 'Special' | 'Status';
}

export interface SlotTyping {
  types: string[];
}

export interface TeamCoverage {
  /** best offensive multiplier the team has into each defending type */
  offense: Record<TypeName, number>;
  /** per attacking type: how many members take ≥2× / how many resist (<1×) */
  weakCount: Record<TypeName, number>;
  resistCount: Record<TypeName, number>;
}

export function teamCoverage(
  sets: ChampionsSet[],
  getMove: (name: string) => MoveInfo | undefined,
  getTyping: (set: ChampionsSet) => SlotTyping | undefined,
): TeamCoverage {
  const offense = {} as Record<TypeName, number>;
  const weakCount = {} as Record<TypeName, number>;
  const resistCount = {} as Record<TypeName, number>;
  for (const t of TYPES) {
    offense[t] = 0;
    weakCount[t] = 0;
    resistCount[t] = 0;
  }

  const attackTypes = new Set<string>();
  for (const set of sets) {
    for (const move of set.moves) {
      if (!move) continue;
      const info = getMove(move);
      if (info && info.category !== 'Status') attackTypes.add(info.type);
    }
    const typing = getTyping(set);
    if (typing) {
      for (const atk of TYPES) {
        const mult = effectiveness(atk, typing.types);
        if (mult >= 2) weakCount[atk]++;
        else if (mult < 1) resistCount[atk]++;
      }
    }
  }

  for (const def of TYPES) {
    for (const atk of attackTypes) {
      offense[def] = Math.max(offense[def], effectiveness(atk, [def]));
    }
  }

  return { offense, weakCount, resistCount };
}

export interface CoverageGaps {
  /** defending types the team cannot hit super-effectively */
  uncovered: TypeName[];
  /** attacking types with net defensive pressure (weak − resist ≥ 2) */
  weakTo: TypeName[];
}

export function coverageGaps(cov: TeamCoverage): CoverageGaps {
  return {
    uncovered: TYPES.filter((t) => cov.offense[t] < 2),
    weakTo: TYPES.filter((t) => cov.weakCount[t] - cov.resistCount[t] >= 2),
  };
}
