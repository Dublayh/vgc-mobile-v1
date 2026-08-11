import { useEffect, useState } from 'react';
import { UsageLookup, type UsageData } from './usage';

let cached: UsageLookup | null | undefined; // undefined = not fetched, null = missing
let pending: Promise<UsageLookup | null> | null = null;

async function load(): Promise<UsageLookup | null> {
  try {
    const meta = await (
      await fetch(`${import.meta.env.BASE_URL}data/meta.json`)
    ).json();
    const res = await fetch(
      `${import.meta.env.BASE_URL}data/usage/${meta.currentRegulation}.json`,
    );
    if (!res.ok) return (cached = null);
    const data = (await res.json()) as UsageData;
    return (cached = new UsageLookup(data));
  } catch {
    return (cached = null);
  }
}

/**
 * Usage stats for the current regulation, or null when unavailable —
 * usage-powered features must degrade gracefully (hide, don't crash).
 */
export function useUsage(): UsageLookup | null | undefined {
  const [usage, setUsage] = useState<UsageLookup | null | undefined>(cached);
  useEffect(() => {
    if (cached !== undefined) return;
    pending ??= load();
    let live = true;
    pending.then((u) => live && setUsage(u));
    return () => {
      live = false;
    };
  }, []);
  return usage;
}
