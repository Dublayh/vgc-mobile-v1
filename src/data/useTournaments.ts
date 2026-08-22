import { useEffect, useState } from 'react';
import type { TournamentData } from './tournaments';

let cached: TournamentData | null | undefined; // undefined = not fetched, null = missing
let pending: Promise<TournamentData | null> | null = null;

async function load(): Promise<TournamentData | null> {
  try {
    const meta = await (
      await fetch(`${import.meta.env.BASE_URL}data/meta.json`)
    ).json();
    const res = await fetch(
      `${import.meta.env.BASE_URL}data/tournaments/${meta.currentRegulation}.json`,
    );
    if (!res.ok) return (cached = null);
    return (cached = (await res.json()) as TournamentData);
  } catch {
    return (cached = null);
  }
}

/** Tournament results for the current regulation, or null when unavailable. */
export function useTournaments(): TournamentData | null | undefined {
  const [data, setData] = useState<TournamentData | null | undefined>(cached);
  useEffect(() => {
    if (cached !== undefined) return;
    pending ??= load();
    let live = true;
    pending.then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, []);
  return data;
}
