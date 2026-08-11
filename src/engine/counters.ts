/**
 * CounterFinder (plan §4 threat-advisor): rank candidate answers to a threat.
 * Candidates are real meta sets; every number comes from auditMatchup, so any
 * suggestion can be reproduced in CalcView.
 */
import { auditMatchup, type AuditContext, type MatchupAudit } from './threat';
import type { ChampionsSet } from './types';

export interface CounterCandidate {
  set: ChampionsSet;
  /** display name of the forme that fights (mega if the set megas) */
  name: string;
  usage: number; // 0..1
}

export interface RankedCounter extends CounterCandidate {
  audit: MatchupAudit;
  score: number;
  /** human-readable why-lines, e.g. "takes 31% max", "OHKOs back" */
  evidence: string[];
}

/**
 * Score: survive well, hit back hard, be fast, be a real pick.
 * Tuned for ordering, not absolute meaning.
 */
function scoreAudit(audit: MatchupAudit, usage: number): number {
  const incoming = audit.incoming?.maxPercent ?? 0;
  const outgoing = audit.outgoing?.maxPercent ?? 0;
  let score = 0;
  score += (100 - Math.min(incoming, 150)) / 100; // survivability (negative if far past OHKO)
  score += Math.min(outgoing, 130) / 100; // threat back
  if (outgoing >= 100) score += 0.5; // OHKO bonus
  if (audit.actsFirst) score += 0.3; // field-aware (Trick Room / Tailwind)
  if (audit.verdict === 'safe') score += 0.6;
  if (audit.verdict === 'loses') score -= 1.2;
  score += usage * 0.6; // prefer proven picks
  return score;
}

function evidenceLines(audit: MatchupAudit): string[] {
  const lines: string[] = [];
  if (audit.incoming) {
    lines.push(`takes ${audit.incoming.maxPercent}% max from ${audit.incoming.move}`);
  } else {
    lines.push('takes no damage from its common moves');
  }
  if (audit.outgoing) {
    lines.push(
      `${audit.outgoing.maxPercent >= 100 ? 'OHKOs back' : `deals ${audit.outgoing.maxPercent}% max`} with ${audit.outgoing.move}`,
    );
  } else {
    lines.push('cannot damage it back');
  }
  lines.push(
    audit.speed === 'tie'
      ? `speed tie (${audit.mySpeed})`
      : `acts ${audit.actsFirst ? 'first' : 'second'} (${audit.mySpeed} vs ${audit.theirSpeed})`,
  );
  return lines;
}

export function findCounters(
  threat: ChampionsSet,
  candidates: CounterCandidate[],
  opts: AuditContext & { limit?: number } = {},
): RankedCounter[] {
  const { limit, ...ctx } = opts;
  const ranked: RankedCounter[] = [];
  for (const c of candidates) {
    // A mirror of the threat itself is not an interesting answer.
    if (c.set.species === threat.species && c.set.megaStone === threat.megaStone) continue;
    try {
      const audit = auditMatchup(c.set, threat, ctx);
      ranked.push({ ...c, audit, score: scoreAudit(audit, c.usage), evidence: evidenceLines(audit) });
    } catch {
      // species/moves outside calc data — skip silently
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit ?? 15);
}
