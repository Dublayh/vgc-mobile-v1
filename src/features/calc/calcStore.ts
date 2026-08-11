import { create } from 'zustand';
import type { FieldOptions } from '../../engine/calc';
import type { ChampionsSet } from '../../engine/types';

/**
 * A calc participant is always an EDITABLE working copy of a set:
 *  - picked from a team → seeded with the saved spread (label = team name)
 *  - picked from the dex → seeded with its most common ladder set, or a
 *    0-SP baseline when it has no usage data
 * Edits live only in the calc — they never write back to saved teams.
 */
export interface CalcSelection {
  set: ChampionsSet;
  sourceLabel: string;
  fromTeam: boolean;
  edited?: boolean;
}

export interface SlotRef {
  teamId: string;
  slot: number;
}

export interface BoostState {
  atk: number;
  spa: number;
  def: number;
  spd: number;
}

const NO_BOOSTS: BoostState = { atk: 0, spa: 0, def: 0, spd: 0 };

interface CalcState {
  attacker: CalcSelection | null;
  defender: CalcSelection | null;
  /** move used when the attacker is dex-sourced (saved sets bring their own) */
  customMove: string | null;
  gameType: 'Doubles' | 'Singles';
  weather: FieldOptions['weather'];
  terrain: FieldOptions['terrain'];
  helpingHand: boolean;
  friendGuard: boolean;
  screens: { reflect: boolean; lightScreen: boolean; auroraVeil: boolean };
  attackerBurned: boolean;
  attackerBoosts: BoostState;
  defenderBoosts: BoostState;
  isCrit: boolean;
  expandedMove: number | null;

  patch: (p: Partial<CalcState>) => void;
  swap: () => void;
  reset: () => void;
}

const initial = {
  attacker: null as CalcSelection | null,
  defender: null as CalcSelection | null,
  customMove: null,
  gameType: 'Doubles' as const,
  weather: undefined,
  terrain: undefined,
  helpingHand: false,
  friendGuard: false,
  screens: { reflect: false, lightScreen: false, auroraVeil: false },
  attackerBurned: false,
  attackerBoosts: { ...NO_BOOSTS },
  defenderBoosts: { ...NO_BOOSTS },
  isCrit: false,
  expandedMove: null,
};

export const useCalc = create<CalcState>((set) => ({
  ...initial,
  patch: (p) => set(p),
  swap: () =>
    set((s) => ({
      attacker: s.defender,
      defender: s.attacker,
      customMove: null,
      attackerBoosts: { ...NO_BOOSTS },
      defenderBoosts: { ...NO_BOOSTS },
      attackerBurned: false,
      expandedMove: null,
    })),
  reset: () => set(initial),
}));
