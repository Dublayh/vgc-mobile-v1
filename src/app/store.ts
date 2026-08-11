import { create } from 'zustand';

export type Tab = 'teams' | 'calc' | 'dex' | 'meta';

/**
 * Navigation state, mirrored to the URL hash for deep links and dev:
 *   #teams · #teams/<teamId> · #teams/<teamId>/<slot> · #dex · #dex/<speciesId>
 */
interface UIState {
  tab: Tab;
  teamId: string | null;
  slot: number | null; // set index being edited within teamId
  dexSpecies: string | null;
  setTab: (tab: Tab) => void;
  openTeam: (id: string | null) => void;
  openSlot: (slot: number | null) => void;
  openDexSpecies: (id: string | null) => void;
}

function parseHash(): Partial<UIState> {
  const parts = location.hash.replace(/^#/, '').split('/').filter(Boolean);
  const tab = (['teams', 'calc', 'dex', 'meta'] as const).find((t) => t === parts[0]);
  if (!tab) return {};
  if (tab === 'teams') {
    return {
      tab,
      teamId: parts[1] ?? null,
      slot: parts[2] !== undefined ? Number(parts[2]) : null,
    };
  }
  if (tab === 'dex') return { tab, dexSpecies: parts[1] ?? null };
  return { tab };
}

function writeHash(s: UIState) {
  let hash = `#${s.tab}`;
  if (s.tab === 'teams' && s.teamId) {
    hash += `/${s.teamId}`;
    if (s.slot !== null) hash += `/${s.slot}`;
  } else if (s.tab === 'dex' && s.dexSpecies) {
    hash += `/${s.dexSpecies}`;
  }
  history.replaceState(null, '', hash);
}

export const useUI = create<UIState>((set, get) => {
  const apply = (patch: Partial<UIState>) => {
    set(patch);
    writeHash(get());
  };
  return {
    tab: 'teams',
    teamId: null,
    slot: null,
    dexSpecies: null,
    ...parseHash(),
    setTab: (tab) => apply({ tab }),
    openTeam: (teamId) => apply({ teamId, slot: null }),
    openSlot: (slot) => apply({ slot }),
    openDexSpecies: (dexSpecies) => apply({ dexSpecies }),
  };
});
