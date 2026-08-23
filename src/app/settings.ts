import { create } from 'zustand';

/**
 * App-wide preferences, persisted to localStorage.
 * gameMode drives every damage-calc gameType default (calc field, threat
 * audits, counters, OHKO sweeps) — Doubles applies spread-move penalties,
 * Singles doesn't. Ladder usage/tournament DATA remains doubles-sourced;
 * the Meta tab labels that when Singles is active.
 */
export type GameMode = 'Doubles' | 'Singles';

const KEY = 'ctb-game-mode';

export function getStoredGameMode(): GameMode {
  try {
    return localStorage.getItem(KEY) === 'Singles' ? 'Singles' : 'Doubles';
  } catch {
    return 'Doubles';
  }
}

interface SettingsState {
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  gameMode: getStoredGameMode(),
  setGameMode: (gameMode) => {
    try {
      localStorage.setItem(KEY, gameMode);
    } catch {
      /* storage unavailable — session-only */
    }
    set({ gameMode });
  },
}));
