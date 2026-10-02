import { create } from 'zustand';

export type Tab = 'teams' | 'calc' | 'dex' | 'meta';
export type MetaSegment = 'usage' | 'speed' | 'threats' | 'tourney';
export type CalcScreen = 'matchup' | 'sweep';
export type ThreatView = 'worst' | 'browse';

/**
 * Navigation state, mirrored to the URL hash with REAL history entries —
 * the browser/phone back button pops one nested level at a time:
 *   #teams · #teams/<teamId> · #teams/<teamId>/<slot>
 *   #calc · #calc/sweep
 *   #dex · #dex/<speciesId> · #dex/<speciesId>/<forme>
 *   #meta/<segment> · #meta/usage/<mon> · #meta/threats/<mon> · #meta/threats/browse
 *   #share/<blob>
 * Forward navigation pushes; popstate re-parses without pushing.
 * ANY nested screen must live here, not in component state, or back won't see it.
 */
interface NavState {
  tab: Tab;
  teamId: string | null;
  slot: number | null;
  calcScreen: CalcScreen;
  dexSpecies: string | null;
  /** forme name shown on the dex detail (null = base) */
  dexForme: string | null;
  shareBlob: string | null;
  metaSegment: MetaSegment;
  /** usage-detail mon name (Meta › Usage) */
  metaMon: string | null;
  /** selected threat name (Meta › Threats) */
  threatName: string | null;
  threatView: ThreatView;
}

interface UIState extends NavState {
  /** team the Meta tab's team-aware views (Speed, Threats) are looking at */
  metaTeamId: string | null;
  setTab: (tab: Tab) => void;
  openTeam: (id: string | null) => void;
  openSlot: (slot: number | null) => void;
  openCalc: (screen: CalcScreen) => void;
  openDexSpecies: (id: string | null) => void;
  openDexForme: (name: string | null) => void;
  clearShare: () => void;
  setMetaSegment: (segment: MetaSegment) => void;
  openMetaMon: (name: string | null) => void;
  openThreat: (name: string | null) => void;
  setThreatView: (view: ThreatView) => void;
  setMetaTeamId: (id: string | null) => void;
}

const DEFAULT_NAV: NavState = {
  tab: 'teams',
  teamId: null,
  slot: null,
  calcScreen: 'matchup',
  dexSpecies: null,
  dexForme: null,
  shareBlob: null,
  metaSegment: 'usage',
  metaMon: null,
  threatName: null,
  threatView: 'worst',
};

const TABS: readonly Tab[] = ['teams', 'calc', 'dex', 'meta'];
const SEGMENTS: readonly MetaSegment[] = ['usage', 'speed', 'threats', 'tourney'];

function parseHash(): NavState {
  const nav = { ...DEFAULT_NAV };
  const parts = location.hash
    .replace(/^#/, '')
    .split('/')
    .filter(Boolean)
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });

  if (parts[0] === 'share' && parts[1]) {
    nav.shareBlob = parts[1];
    return nav;
  }
  const tab = TABS.find((t) => t === parts[0]);
  if (!tab) return nav;
  nav.tab = tab;
  if (tab === 'teams') {
    nav.teamId = parts[1] ?? null;
    nav.slot = parts[2] !== undefined ? Number(parts[2]) : null;
  } else if (tab === 'calc') {
    nav.calcScreen = parts[1] === 'sweep' ? 'sweep' : 'matchup';
  } else if (tab === 'dex') {
    nav.dexSpecies = parts[1] ?? null;
    nav.dexForme = parts[2] ?? null;
  } else if (tab === 'meta') {
    nav.metaSegment = SEGMENTS.find((s) => s === parts[1]) ?? 'usage';
    if (nav.metaSegment === 'usage') nav.metaMon = parts[2] ?? null;
    if (nav.metaSegment === 'threats') {
      if (parts[2] === 'browse') nav.threatView = 'browse';
      else nav.threatName = parts[2] ?? null;
    }
  }
  return nav;
}

function toHash(s: NavState): string {
  if (s.shareBlob) return `#share/${s.shareBlob}`;
  let hash = `#${s.tab}`;
  if (s.tab === 'teams' && s.teamId) {
    hash += `/${s.teamId}`;
    if (s.slot !== null) hash += `/${s.slot}`;
  } else if (s.tab === 'calc') {
    if (s.calcScreen === 'sweep') hash += '/sweep';
  } else if (s.tab === 'dex' && s.dexSpecies) {
    hash += `/${encodeURIComponent(s.dexSpecies)}`;
    if (s.dexForme) hash += `/${encodeURIComponent(s.dexForme)}`;
  } else if (s.tab === 'meta') {
    hash += `/${s.metaSegment}`;
    const leaf =
      s.metaSegment === 'usage'
        ? s.metaMon
        : s.metaSegment === 'threats'
          ? (s.threatName ?? (s.threatView === 'browse' ? 'browse' : null))
          : null;
    if (leaf) hash += `/${encodeURIComponent(leaf)}`;
  }
  return hash;
}

export const useUI = create<UIState>((set, get) => {
  const apply = (patch: Partial<NavState>) => {
    set(patch);
    const hash = toHash(get());
    if (location.hash !== hash) history.pushState(null, '', hash);
  };
  return {
    ...parseHash(),
    metaTeamId: null,
    setTab: (tab) => apply({ tab, shareBlob: null }),
    openTeam: (teamId) => apply({ tab: 'teams', teamId, slot: null, shareBlob: null }),
    openSlot: (slot) => apply({ slot }),
    openCalc: (calcScreen) => apply({ tab: 'calc', calcScreen, shareBlob: null }),
    openDexSpecies: (dexSpecies) => apply({ dexSpecies, dexForme: null }),
    openDexForme: (dexForme) => apply({ dexForme }),
    clearShare: () => apply({ shareBlob: null }),
    setMetaSegment: (metaSegment) => apply({ metaSegment, metaMon: null, threatName: null }),
    openMetaMon: (metaMon) => apply({ metaMon }),
    openThreat: (threatName) => apply({ threatName }),
    setThreatView: (threatView) => apply({ threatView, threatName: null }),
    setMetaTeamId: (metaTeamId) => set({ metaTeamId }),
  };
});

// Back/forward (and manual hash edits) re-parse WITHOUT pushing new entries.
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    useUI.setState(parseHash());
  });
}
