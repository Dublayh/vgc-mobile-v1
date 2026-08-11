/**
 * 1v1 threat audit between two sets (plan §4 threat-advisor/TeamAudit).
 * Uses max damage rolls both ways plus speed order in a crude turn simulation.
 * A heuristic — verdicts are advisory, and every number is a real calc that
 * can be reproduced in CalcView.
 */
import { buildField, runCalc, toCalcPokemon } from './calc';
import { effectiveSpeed } from './speed';
import type { ChampionsSet } from './types';

export interface BestMove {
  move: string;
  maxPercent: number;
}

/** Field state that changes acting order (team archetypes live here). */
export interface AuditContext {
  gameType?: 'Doubles' | 'Singles';
  trickRoom?: boolean;
  myTailwind?: boolean;
  theirTailwind?: boolean;
}

export interface MatchupAudit {
  /** threat's best damaging move vs. mine (null = no damaging move known) */
  incoming: BestMove | null;
  /** my best damaging move vs. the threat */
  outgoing: BestMove | null;
  /** relative EFFECTIVE speed (tailwinds applied) */
  speed: 'faster' | 'slower' | 'tie';
  mySpeed: number; // effective
  theirSpeed: number; // effective
  /** whether my set acts first under the given field (TR inverts; ties = false) */
  actsFirst: boolean;
  verdict: 'safe' | 'shaky' | 'loses';
}

function bestMove(
  attacker: ReturnType<typeof toCalcPokemon>,
  attackerMoves: (string | undefined)[],
  defender: ReturnType<typeof toCalcPokemon>,
  gameType: 'Doubles' | 'Singles',
): BestMove | null {
  const field = buildField({ gameType });
  let best: BestMove | null = null;
  for (const move of attackerMoves) {
    if (!move) continue;
    try {
      const r = runCalc(attacker, defender, move, field);
      if (r.maxPercent > 0 && (!best || r.maxPercent > best.maxPercent)) {
        best = { move, maxPercent: r.maxPercent };
      }
    } catch {
      // unknown move in calc data — skip
    }
  }
  return best;
}

const hitsToKO = (best: BestMove | null): number =>
  best && best.maxPercent > 0 ? Math.ceil(100 / best.maxPercent) : Infinity;

export function auditMatchup(
  mine: ChampionsSet,
  threat: ChampionsSet,
  ctx: AuditContext = {},
): MatchupAudit {
  const gameType = ctx.gameType ?? 'Doubles';
  const me = toCalcPokemon(mine, { formeName: mine.megaStone });
  const them = toCalcPokemon(threat, { formeName: threat.megaStone });

  const mySpeed = effectiveSpeed(me.rawStats.spe, { tailwind: ctx.myTailwind });
  const theirSpeed = effectiveSpeed(them.rawStats.spe, { tailwind: ctx.theirTailwind });
  const speed = mySpeed > theirSpeed ? 'faster' : mySpeed < theirSpeed ? 'slower' : 'tie';

  // Trick Room inverts acting order; speed ties are treated as acting second.
  const actsFirst = ctx.trickRoom ? mySpeed < theirSpeed : mySpeed > theirSpeed;

  const incoming = bestMove(them, threat.moves, me, gameType);
  const outgoing = bestMove(me, mine.moves, them, gameType);

  const toKOMe = hitsToKO(incoming);
  const toKOThem = hitsToKO(outgoing);

  // Turn simulation: acting first means I win ties in hits-to-KO.
  const win =
    toKOThem !== Infinity && (actsFirst ? toKOThem <= toKOMe : toKOThem < toKOMe);

  let verdict: MatchupAudit['verdict'];
  if (win) {
    // Comfortable if I have a full hit of slack or they can't 2HKO me.
    verdict = toKOMe - toKOThem >= 1 || toKOMe >= 3 ? 'safe' : 'shaky';
  } else if (toKOThem !== Infinity && toKOThem - toKOMe <= 1) {
    verdict = 'shaky';
  } else {
    verdict = 'loses';
  }

  return { incoming, outgoing, speed, mySpeed, theirSpeed, actsFirst, verdict };
}
