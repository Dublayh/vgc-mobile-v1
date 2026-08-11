import { useEffect, useState } from 'react';
import { DexLookup, type RegulationData } from './dex';

let cached: DexLookup | null = null;
let pending: Promise<DexLookup> | null = null;

async function load(): Promise<DexLookup> {
  const base = import.meta.env.BASE_URL;
  const meta = await (await fetch(`${base}data/meta.json`)).json();
  const [dex, regulation] = await Promise.all([
    (await fetch(`${base}data/dex.json`)).json(),
    (await fetch(`${base}data/regulations/${meta.currentRegulation}.json`)).json() as Promise<RegulationData>,
  ]);
  cached = new DexLookup(dex, regulation);
  return cached;
}

/**
 * The whole static data bundle (dex + current regulation) as one lookup
 * object. Null on first paint while fetching; cached for the session after.
 */
export function useDex(): DexLookup | null {
  const [lookup, setLookup] = useState<DexLookup | null>(cached);
  useEffect(() => {
    if (cached) return;
    pending ??= load();
    let live = true;
    pending.then((l) => live && setLookup(l));
    return () => {
      live = false;
    };
  }, []);
  return lookup;
}
