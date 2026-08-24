import { create } from 'zustand';

export type Tab = 'teams' | 'calc' | 'dex' | 'meta';
export type MetaSegment = 'usage' | 'speed' | 'threats' | 'tourney';

/**
 * Navigation state, mirrored to the URL hash with REAL history entries —
 * the browser/phone back button pops one nested level at a time:
 *   #teams · #teams/<teamId> · #teams/<teamId>/<slot>
 *   #dex · #dex/<speciesId>
 *   #meta/<segment> · #meta/usage/<mon> · #meta/threats/<mon>
 *   #share/<blob>
 * Forward navigation pushes; popstate re-parses without pushing.
 */
interface NavState {
  tab: Tab;
  teamId: string | null;
  slot: number | null;
  dexSpecies: string | null;
  shareBlob: string | null;
  metaSegment: MetaSegment;
  /** usage-detail mon name (Meta › Usage) */
  metaMon: string | null;
  /** selected threat name (Meta › Threats) */
  threatName: string | null;
}

interface UIState extends NavState {
  setTab: (tab: Tab) => void;
  openTeam: (id: string | null) => void;
  openSlot: (slot: number | null) => void;
  openDexSpecies: (id: string | null) => void;
  clearShare: () => void;
  setMetaSegment: (segment: MetaSegment) => void;
  openMetaMon: (name: string | null) => void;
  openThreat: (name: string | null) => void;
}

const DEFAULT_NAV: NavState = {
  tab: 'teams',
  teamId: null,
  slot: null,
  dexSpecies: null,
  shareBlob: null,
  metaSegment: 'usage',
  metaMon: null,
  threatName: null,
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
  } else if (tab === 'dex') {
    nav.dexSpecies = parts[1] ?? null;
  } else if (tab === 'meta') {
    nav.metaSegment = SEGMENTS.find((s) => s === parts[1]) ?? 'usage';
    if (nav.metaSegment === 'usage') nav.metaMon = parts[2] ?? null;
    if (nav.metaSegment === 'threats') nav.threatName = parts[2] ?? null;
  }
  return nav;
}

function toHash(s: NavState): string {
  if (s.shareBlob) return `#share/${s.shareBlob}`;
  let hash = `#${s.tab}`;
  if (s.tab === 'teams' && s.teamId) {
    hash += `/${s.teamId}`;
    if (s.slot !== null) hash += `/${s.slot}`;
  } else if (s.tab === 'dex' && s.dexSpecies) {
    hash += `/${encodeURIComponent(s.dexSpecies)}`;
  } else if (s.tab === 'meta') {
    hash += `/${s.metaSegment}`;
    const name = s.metaSegment === 'usage' ? s.metaMon : s.metaSegment === 'threats' ? s.threatName : null;
    if (name) hash += `/${encodeURIComponent(name)}`;
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
    setTab: (tab) => apply({ tab, shareBlob: null }),
    openTeam: (teamId) => apply({ tab: 'teams', teamId, slot: null, shareBlob: null }),
    openSlot: (slot) => apply({ slot }),
    openDexSpecies: (dexSpecies) => apply({ dexSpecies }),
    clearShare: () => apply({ shareBlob: null }),
    setMetaSegment: (metaSegment) => apply({ metaSegment, metaMon: null, threatName: null }),
    openMetaMon: (metaMon) => apply({ metaMon }),
    openThreat: (threatName) => apply({ threatName }),
  };
});

// Back/forward (and manual hash edits) re-parse WITHOUT pushing new entries.
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    useUI.setState(parseHash());
  });
}
