import { useEffect, useState } from 'react';
import { useSettings, type GameMode } from '../app/settings';
import { UsageLookup, type UsageData } from './usage';

// Per-mode caches: undefined = not fetched, null = missing entirely.
const caches: Record<GameMode, UsageLookup | null | undefined> = {
  Doubles: undefined,
  Singles: undefined,
};
const pending: Partial<Record<GameMode, Promise<UsageLookup | null>>> = {};

async function fetchBundle(file: string): Promise<UsageLookup | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/usage/${file}`);
    if (!res.ok) return null;
    return new UsageLookup((await res.json()) as UsageData);
  } catch {
    return null;
  }
}

async function load(mode: GameMode): Promise<UsageLookup | null> {
  try {
    const meta = await (
      await fetch(`${import.meta.env.BASE_URL}data/meta.json`)
    ).json();
    const reg = meta.currentRegulation as string;
    const prev = meta.previousRegulation as string | undefined;
    // Fallback chain: mode bundle → doubles bundle (Singles only) for the
    // current regulation, then the same pair for the previous regulation —
    // a fresh regulation has no ladder stats until Smogon publishes its first
    // month, and the old reg's meta is the best available signal meanwhile.
    // Consumers label fallbacks via lookup.staleRegulation / isSinglesData().
    const candidates: [string, string][] = [];
    for (const r of prev ? [reg, prev] : [reg]) {
      if (mode === 'Singles') candidates.push([`${r}-singles.json`, r]);
      candidates.push([`${r}.json`, r]);
    }
    for (const [file, r] of candidates) {
      const lookup = await fetchBundle(file);
      if (lookup) {
        if (r !== reg) lookup.staleRegulation = r;
        return (caches[mode] = lookup);
      }
    }
    return (caches[mode] = null);
  } catch {
    return (caches[mode] = null);
  }
}

/**
 * Ladder usage stats for the current regulation AND game mode, or null when
 * unavailable — usage-powered features must degrade gracefully. In Singles
 * mode this serves the singles ladder bundle (doubles as fallback; check
 * `lookup.data.format` for "bss" to know which you got).
 */
export function useUsage(): UsageLookup | null | undefined {
  const mode = useSettings((s) => s.gameMode);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (caches[mode] !== undefined) return;
    pending[mode] ??= load(mode);
    let live = true;
    void pending[mode]!.then(() => live && setTick((t) => t + 1));
    return () => {
      live = false;
    };
  }, [mode]);
  return caches[mode];
}

/** True when the given lookup is actual singles-ladder data. */
export function isSinglesData(lookup: UsageLookup | null | undefined): boolean {
  return !!lookup?.data.format.includes('bss');
}
