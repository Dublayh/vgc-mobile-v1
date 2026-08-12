/**
 * OptimizerPanel (plan §4 damage-calc): exact brute-force SP solvers over the
 * current calc matchup — "min SP to survive their best move" and "min Spe SP
 * to outspeed". Respects the current field + boosts; applies to the working
 * copies (calc-only, like all calc edits).
 */
import { useMemo, useState } from 'react';
import { Button } from '../../app/ui/Button';
import { Panel } from '../../app/ui/Panel';
import type { DexLookup } from '../../data/dex';
import { buildField, runCalc, toCalcPokemon } from '../../engine/calc';
import { minSPToReachSpeed, minSPToSurvive } from '../../engine/optimizer';
import { computeStat } from '../../engine/stats';
import type { ChampionsSet, StatID } from '../../engine/types';
import { useCalc, type CalcSelection } from './calcStore';

const SURVIVE_STATS: StatID[] = ['hp', 'def', 'spd'];

export function OptimizerPanel({
  attacker,
  defender,
  lookup,
  onUpdateAttacker,
  onUpdateDefender,
}: {
  attacker: CalcSelection;
  defender: CalcSelection;
  lookup: DexLookup;
  onUpdateAttacker: (patch: Partial<ChampionsSet>) => void;
  onUpdateDefender: (patch: Partial<ChampionsSet>) => void;
}) {
  const calc = useCalc();
  const [surviveStat, setSurviveStat] = useState<StatID>('hp');

  const field = useMemo(
    () =>
      buildField({
        gameType: calc.gameType,
        weather: calc.weather,
        terrain: calc.terrain,
        attackerSide: { isHelpingHand: calc.helpingHand },
        defenderSide: {
          isReflect: calc.screens.reflect,
          isLightScreen: calc.screens.lightScreen,
          isAuroraVeil: calc.screens.auroraVeil,
          isFriendGuard: calc.friendGuard,
        },
      }),
    [calc],
  );

  const atkPokemon = useMemo(
    () =>
      toCalcPokemon(attacker.set, {
        formeName: attacker.set.megaStone,
        boosts: calc.attackerBoosts,
        status: calc.attackerBurned ? 'brn' : '',
      }),
    [attacker.set, calc.attackerBoosts, calc.attackerBurned],
  );

  /** Attacker's strongest move vs. the CURRENT defender spread. */
  const bestMove = useMemo(() => {
    const def = toCalcPokemon(defender.set, {
      formeName: defender.set.megaStone,
      boosts: calc.defenderBoosts,
    });
    let best: { move: string; pct: number } | null = null;
    for (const move of attacker.set.moves) {
      if (!move) continue;
      try {
        const r = runCalc(atkPokemon, def, move, field);
        if (r.maxPercent > 0 && (!best || r.maxPercent > best.pct)) {
          best = { move, pct: r.maxPercent };
        }
      } catch {
        /* skip */
      }
    }
    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atkPokemon, defender.set, calc.defenderBoosts, field, attacker.set.moves.join('|')]);

  const survive = useMemo(() => {
    if (!bestMove) return null;
    return minSPToSurvive(defender.set, surviveStat, {
      attacker: atkPokemon,
      moveName: bestMove.move,
      field,
    });
  }, [bestMove, defender.set, surviveStat, atkPokemon, field]);

  const outspeed = useMemo(() => {
    const defSpecies = lookup.getSpecies(defender.set.megaStone ?? defender.set.species);
    const atkSpecies = lookup.getSpecies(attacker.set.megaStone ?? attacker.set.species);
    if (!defSpecies || !atkSpecies) return null;
    const target =
      computeStat(defSpecies.baseStats.spe, defender.set.sp.spe, defender.set.alignment, 'spe') + 1;
    const sp = minSPToReachSpeed(attacker.set, target, (spSpe) =>
      computeStat(atkSpecies.baseStats.spe, spSpe, attacker.set.alignment, 'spe'),
    );
    return { target, sp };
  }, [attacker.set, defender.set, lookup]);

  const defName = defender.set.megaStone ?? defender.set.species;
  const atkName = attacker.set.megaStone ?? attacker.set.species;

  return (
    <Panel title="Optimizer" aside={<span className="label-caps">exact search</span>}>
      <div className="flex flex-col gap-3 text-sm">
        <div>
          <p className="label-caps mb-1.5">
            Min SP for {defName} to survive {bestMove ? bestMove.move : '—'}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {SURVIVE_STATS.map((s) => (
              <button
                key={s}
                onClick={() => setSurviveStat(s)}
                className={`chamfer-sm px-2 py-1 font-display text-xs font-semibold tracking-[0.1em] uppercase ${
                  surviveStat === s ? 'bg-gold-500 text-ink-950' : 'border border-ink-700 text-ink-400'
                }`}
              >
                {s}
              </button>
            ))}
            <span className="stat-num ml-1 text-ink-200">
              {!bestMove
                ? 'no damaging move'
                : survive === null
                  ? 'not reachable within 32 SP / pool'
                  : survive === defender.set.sp[surviveStat]
                    ? `current ${survive} SP already survives`
                    : `${survive} SP`}
            </span>
            {bestMove && survive !== null && survive !== defender.set.sp[surviveStat] && (
              <Button
                variant="secondary"
                className="!px-2 !py-0.5"
                onClick={() =>
                  onUpdateDefender({ sp: { ...defender.set.sp, [surviveStat]: survive } })
                }
              >
                Apply
              </Button>
            )}
          </div>
        </div>

        <div>
          <p className="label-caps mb-1.5">
            Min Spe SP for {atkName} to outspeed {defName}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="stat-num text-ink-200">
              {!outspeed || outspeed.sp === null
                ? 'not reachable (alignment or base speed too low)'
                : outspeed.sp === attacker.set.sp.spe
                  ? `current ${outspeed.sp} SP already outspeeds`
                  : `${outspeed.sp} SP (→ ${outspeed.target})`}
            </span>
            {outspeed?.sp !== null && outspeed !== null && outspeed.sp !== attacker.set.sp.spe && (
              <Button
                variant="secondary"
                className="!px-2 !py-0.5"
                onClick={() => onUpdateAttacker({ sp: { ...attacker.set.sp, spe: outspeed.sp! } })}
              >
                Apply
              </Button>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-500">
            Raw speeds — flip Tailwind/Trick Room reasoning in Meta › Threats.
          </p>
        </div>
      </div>
    </Panel>
  );
}
