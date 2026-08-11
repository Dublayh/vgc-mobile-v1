/**
 * 1v1 threat audit between two sets (plan §4 threat-advisor/TeamAudit).
 * Uses max damage rolls both ways plus speed order in a crude turn simulation.
 * A heuristic — verdicts are advisory, and every number is a real calc that
 * can be reproduced in CalcView.
 */
import { buildField, runCalc, toCalcPokemon } from './calc';
import type { ChampionsSet } from './types';

export interface BestMove {
  move: string;
  maxPercent: number;
}

export interface MatchupAudit {
  /** threat's best damaging move vs. mine (null = no damaging move known) */
  incoming: BestMove | null;
  /** my best damaging move vs. the threat */
  outgoing: BestMove | null;
  speed: 'faster' | 'slower' | 'tie'; // my set relative to the threat
  mySpeed: number;
  theirSpeed: number;
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
  gameType: 'Doubles' | 'Singles' = 'Doubles',
): MatchupAudit {
  const me = toCalcPokemon(mine, { formeName: mine.megaStone });
  const them = toCalcPokemon(threat, { formeName: threat.megaStone });

  const mySpeed = me.rawStats.spe;
  const theirSpeed = them.rawStats.spe;
  const speed = mySpeed > theirSpeed ? 'faster' : mySpeed < theirSpeed ? 'slower' : 'tie';

  const incoming = bestMove(them, threat.moves, me, gameType);
  const outgoing = bestMove(me, mine.moves, them, gameType);

  const toKOMe = hitsToKO(incoming);
  const toKOThem = hitsToKO(outgoing);
  const meFirst = speed === 'faster';

  // Turn simulation: acting first means I win ties in hits-to-KO.
  const win =
    toKOThem !== Infinity && (meFirst ? toKOThem <= toKOMe : toKOThem < toKOMe);

  let verdict: MatchupAudit['verdict'];
  if (win) {
    // Comfortable if I have a full hit of slack or they can't 2HKO me.
    verdict = toKOMe - toKOThem >= 1 || toKOMe >= 3 ? 'safe' : 'shaky';
  } else if (toKOThem !== Infinity && toKOThem - toKOMe <= 1) {
    verdict = 'shaky';
  } else {
    verdict = 'loses';
  }

  return { incoming, outgoing, speed, mySpeed, theirSpeed, verdict };
}
