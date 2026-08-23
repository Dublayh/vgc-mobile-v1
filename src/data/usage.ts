/** Ladder usage stats schema — produced by scripts/build-usage.ts. */
import type { SPSpread } from '../engine/types';

export interface UsageSpread {
  alignment: string;
  sp: SPSpread;
  pct: number; // 0..1
}

export interface UsageMon {
  name: string; // Showdown display name (may be a mega forme)
  rank: number;
  usage: number; // 0..1
  abilities: [string, number][];
  items: [string, number][];
  moves: [string, number][];
  spreads: UsageSpread[];
  teammates: [string, number][];
}

export interface UsageData {
  format: string;
  month: string;
  totalBattles: number;
  /** true only for the checked-in sample file (no real Smogon data yet) */
  synthetic?: boolean;
  generatedAt: string;
  mons: UsageMon[];
  /** slim prior-month snapshot for trends: [name, usage, rank] */
  previous?: { month: string; mons: [string, number, number][] };
}

export interface PrevStats {
  usage: number;
  rank: number;
}

export class UsageLookup {
  readonly data: UsageData;
  private byName = new Map<string, UsageMon>();
  private prevByName = new Map<string, PrevStats>();

  constructor(data: UsageData) {
    this.data = data;
    for (const m of data.mons) this.byName.set(m.name.toLowerCase(), m);
    for (const [name, usage, rank] of data.previous?.mons ?? []) {
      this.prevByName.set(name.toLowerCase(), { usage, rank });
    }
  }

  /** Prior-month stats for a mon, if trend data exists. */
  prevOf(name: string): PrevStats | undefined {
    return this.prevByName.get(name.toLowerCase());
  }

  get prevMonth(): string | undefined {
    return this.data.previous?.month;
  }

  get mons(): UsageMon[] {
    return this.data.mons;
  }

  get(name: string): UsageMon | undefined {
    return this.byName.get(name.toLowerCase());
  }

  top(n: number): UsageMon[] {
    return this.data.mons.slice(0, n);
  }
}
