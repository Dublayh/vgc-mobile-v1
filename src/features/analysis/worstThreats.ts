/**
 * "Worst matchups": every top meta set audited vs. every team slot, ranked
 * by how badly the team does (losses weighted by the threat's usage).
 * Shared by the Threats tab and the Team Completer. Chunked so the UI can
 * paint progress; `cancelled` lets callers abandon a stale run.
 */
import type { DexLookup } from '../../data/dex';
import type { UsageLookup, UsageMon } from '../../data/usage';
import { auditMatchup, type AuditContext } from '../../engine/threat';
import type { ChampionsSet } from '../../engine/types';
import { usageMonToSet } from '../meta/threatSet';

export interface WorstRow {
  name: string;
  usage: number;
  set: ChampionsSet;
  loses: number;
  shaky: number;
  safe: number;
  /** badness first, prevalence as a multiplier */
  score: number;
}

export function auditThreatRow(
  sets: ChampionsSet[],
  threat: UsageMon,
  lookup: DexLookup,
  ctx: AuditContext,
): WorstRow | null {
  const set = usageMonToSet(threat, lookup);
  if (!set) return null;
  let loses = 0;
  let shaky = 0;
  let safe = 0;
  for (const mine of sets) {
    try {
      const a = auditMatchup(mine, set, ctx);
      if (a.verdict === 'loses') loses++;
      else if (a.verdict === 'shaky') shaky++;
      else safe++;
    } catch {
      /* skip uncalcable slots */
    }
  }
  // A 2% mon that 4-0s you matters less than Kingambit doing it.
  return { name: threat.name, usage: threat.usage, set, loses, shaky, safe, score: (loses * 3 + shaky) * (0.3 + threat.usage) };
}

export interface RankOptions {
  /** how many top-usage mons to audit (default 100) */
  top?: number;
  chunk?: number;
  onProgress?: (percent: number) => void;
  /** return true to abandon the run (resolves null) */
  cancelled?: () => boolean;
}

export async function rankWorstThreats(
  sets: ChampionsSet[],
  usage: UsageLookup,
  lookup: DexLookup,
  ctx: AuditContext,
  opts: RankOptions = {},
): Promise<WorstRow[] | null> {
  const threats = usage.top(opts.top ?? 100);
  const chunk = opts.chunk ?? 5;
  const rows: WorstRow[] = [];
  for (let i = 0; i < threats.length; i += chunk) {
    if (opts.cancelled?.()) return null;
    for (const t of threats.slice(i, i + chunk)) {
      const row = auditThreatRow(sets, t, lookup, ctx);
      if (row) rows.push(row);
    }
    opts.onProgress?.(Math.min(100, Math.round(((i + chunk) / threats.length) * 100)));
    await new Promise((r) => setTimeout(r, 0));
  }
  if (opts.cancelled?.()) return null;
  return rows.sort((a, b) => b.score - a.score);
}
