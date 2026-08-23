/**
 * Combined damage (doubles' real question): can these TWO attackers KO the
 * defender together? Exact math over all 16×16 roll pairs — not an estimate.
 * Both attacks are computed under the current field.
 */
import { useMemo, useState } from 'react';
import { Panel } from '../../app/ui/Panel';
import { TypeBadge } from '../../app/ui/TypeBadge';
import type { DexLookup } from '../../data/dex';
import { buildField, runCalc, toCalcPokemon, type DamageResult } from '../../engine/calc';
import { useCalc, type CalcSelection } from './calcStore';

interface MoveResult {
  move: string;
  result: DamageResult;
}

function damaging(
  sel: CalcSelection,
  pokemon: ReturnType<typeof toCalcPokemon>,
  defender: ReturnType<typeof toCalcPokemon>,
  field: ReturnType<typeof buildField>,
): MoveResult[] {
  const out: MoveResult[] = [];
  for (const move of sel.set.moves) {
    if (!move) continue;
    try {
      const result = runCalc(pokemon, defender, move, field);
      if (result.maxPercent > 0) out.push({ move, result });
    } catch {
      /* skip */
    }
  }
  return out.sort((a, b) => b.result.maxPercent - a.result.maxPercent);
}

export function ComboPanel({
  attacker,
  partner,
  defender,
  lookup,
}: {
  attacker: CalcSelection;
  partner: CalcSelection;
  defender: CalcSelection;
  lookup: DexLookup;
}) {
  const calc = useCalc();
  const [moveA, setMoveA] = useState<string | null>(null);
  const [moveB, setMoveB] = useState<string | null>(null);

  const combo = useMemo(() => {
    const field = buildField({
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
    });
    const def = toCalcPokemon(defender.set, {
      formeName: defender.set.megaStone,
      boosts: calc.defenderBoosts,
    });
    const atkA = toCalcPokemon(attacker.set, {
      formeName: attacker.set.megaStone,
      boosts: calc.attackerBoosts,
      status: calc.attackerBurned ? 'brn' : '',
    });
    const atkB = toCalcPokemon(partner.set, {
      formeName: partner.set.megaStone,
      boosts: calc.attacker2Boosts,
    });
    return {
      hp: def.maxHP(),
      optionsA: damaging(attacker, atkA, def, field),
      optionsB: damaging(partner, atkB, def, field),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attacker, partner, defender, calc]);

  const pickA = combo.optionsA.find((o) => o.move === moveA) ?? combo.optionsA[0];
  const pickB = combo.optionsB.find((o) => o.move === moveB) ?? combo.optionsB[0];

  const summary = useMemo(() => {
    if (!pickA || !pickB) return null;
    const a = pickA.result.rolls;
    const b = pickB.result.rolls;
    let ko = 0;
    let min = Infinity;
    let max = 0;
    for (const ra of a) {
      for (const rb of b) {
        const sum = ra + rb;
        if (sum >= combo.hp) ko++;
        if (sum < min) min = sum;
        if (sum > max) max = sum;
      }
    }
    const pairs = a.length * b.length;
    return {
      minPct: Math.round((min / combo.hp) * 1000) / 10,
      maxPct: Math.round((max / combo.hp) * 1000) / 10,
      koPct: Math.round((ko / pairs) * 1000) / 10,
      ko,
      pairs,
    };
  }, [pickA, pickB, combo.hp]);

  const name = (sel: CalcSelection) => sel.set.megaStone ?? sel.set.species;

  const moveChips = (
    options: MoveResult[],
    pick: MoveResult | undefined,
    onPick: (m: string) => void,
  ) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.move}
          onClick={() => onPick(o.move)}
          className={`chamfer-sm flex items-center gap-1.5 px-2 py-1 font-display text-xs font-semibold tracking-[0.06em] uppercase ${
            pick?.move === o.move
              ? 'bg-gold-500 text-ink-950'
              : 'border border-ink-700 text-ink-300'
          }`}
        >
          {(() => {
            const m = lookup.getMove(o.move);
            return m ? <TypeBadge type={m.type} size="sm" /> : null;
          })()}
          {o.move}
          <span className="stat-num normal-case opacity-75">{o.result.maxPercent}%</span>
        </button>
      ))}
      {options.length === 0 && (
        <span className="text-xs text-ink-500">no damaging move vs. this defender</span>
      )}
    </div>
  );

  return (
    <Panel
      title={`Combo vs ${name(defender)}`}
      aside={
        summary && (
          <span
            className={`stat-num text-sm ${summary.koPct >= 100 ? 'text-illegal' : summary.koPct > 0 ? 'text-warn' : 'text-ink-300'}`}
          >
            KO {summary.koPct}%
          </span>
        )
      }
    >
      <div className="flex flex-col gap-2.5">
        <div>
          <p className="label-caps mb-1">{name(attacker)}</p>
          {moveChips(combo.optionsA, pickA, setMoveA)}
        </div>
        <div>
          <p className="label-caps mb-1">{name(partner)}</p>
          {moveChips(combo.optionsB, pickB, setMoveB)}
        </div>

        {summary ? (
          <div>
            <div className="mb-1.5 h-2 bg-ink-800">
              <div
                className={`h-full ${summary.maxPct >= 100 ? 'bg-illegal' : 'bg-gold-500'}`}
                style={{ width: `${Math.min(100, summary.maxPct)}%` }}
              />
            </div>
            <p className="stat-num text-sm text-ink-100">
              Combined {summary.minPct} – {summary.maxPct}% ·{' '}
              {summary.koPct >= 100
                ? 'guaranteed KO'
                : summary.koPct <= 0
                  ? 'never KOs'
                  : `${summary.koPct}% to KO (${summary.ko}/${summary.pairs} roll pairs)`}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              Exact over all roll pairs. Field settings apply to both attacks; damage-order
              effects (Weakness Policy, berries) aren't modeled.
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-500">Pick a damaging move for each attacker.</p>
        )}
      </div>
    </Panel>
  );
}
