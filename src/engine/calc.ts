/**
 * Damage calc wrapper around @smogon/calc — Approach A from the plan:
 * we compute final stats ourselves with the Champions formula (stats.ts) and
 * inject them into the calc's Pokemon objects, bypassing its internal EV/nature
 * math entirely. This sidesteps the SP-vs-EV rounding question inside the library.
 */
import {
  calculate,
  Field,
  Generations,
  Move,
  Pokemon,
  type Result,
} from '@smogon/calc';
import type { MoveName, NatureName } from '@smogon/calc/dist/data/interface';
import { computeStats, DEFAULT_SP_MODE, type SPRoundingMode } from './stats';
import {
  CHAMPIONS_LEVEL,
  type ChampionsSet,
  type SPSpread,
  type StatsTable,
} from './types';

/** Champions runs on Gen 9 mechanics (mirroring Showdown's Champions formats). */
export const GEN = Generations.get(9);

export interface FieldOptions {
  gameType?: 'Singles' | 'Doubles';
  weather?: 'Sand' | 'Sun' | 'Rain' | 'Snow' | 'Hail';
  terrain?: 'Electric' | 'Grassy' | 'Psychic' | 'Misty';
  attackerSide?: SideOptions;
  defenderSide?: SideOptions;
}

export interface SideOptions {
  isReflect?: boolean;
  isLightScreen?: boolean;
  isAuroraVeil?: boolean;
  isHelpingHand?: boolean;
  isTailwind?: boolean;
  isFriendGuard?: boolean;
  isProtected?: boolean;
}

export interface CalcPokemonOptions {
  /** Use the mega forme (Omni Ring). Caller passes the resolved forme name. */
  formeName?: string;
  boosts?: Partial<StatsTable>;
  status?: 'slp' | 'psn' | 'brn' | 'frz' | 'par' | 'tox' | '';
  curHPPercent?: number; // 0–100
  spMode?: SPRoundingMode;
}

/**
 * Build a @smogon/calc Pokemon carrying Champions-correct stats. `formeName`
 * (e.g. "Garchomp-Mega") switches to the mega forme; SP/alignment stay the
 * same but base stats come from the forme.
 *
 * Approach A, clone-proof variant: `calculate()` CLONES its inputs and
 * recomputes stats from base/IV/EV/nature — mutating rawStats after
 * construction does NOT survive (caught by an on-screen calc mismatch).
 * Instead we exploit that clone() re-passes `overrides`: at level 50 /
 * IV 31 / EV 0 / neutral nature the library's formula reduces to
 *   nonHP = base + 20,  HP = base + 75
 * so we pass inverted base stats via `overrides.baseStats` and the library
 * computes our exact Champions stats — on the original AND every clone.
 */
export function toCalcPokemon(set: ChampionsSet, opts: CalcPokemonOptions = {}): Pokemon {
  const name = opts.formeName ?? set.species;
  const realBase = new Pokemon(GEN, name).species.baseStats as StatsTable;
  const stats = computeStats(realBase, set.sp, set.alignment, opts.spMode ?? DEFAULT_SP_MODE);

  const invertedBase: StatsTable = {
    hp: realBase.hp === 1 ? 1 : stats.hp - 75, // base HP 1 = Shedinja special case
    atk: stats.atk - 20,
    def: stats.def - 20,
    spa: stats.spa - 20,
    spd: stats.spd - 20,
    spe: stats.spe - 20,
  };

  const pokemon = new Pokemon(GEN, name, {
    level: CHAMPIONS_LEVEL,
    ability: set.ability as Pokemon['ability'],
    item: set.item as Pokemon['item'],
    nature: 'Serious' as NatureName, // alignment already applied in computeStats
    overrides: { baseStats: invertedBase },
    boosts: opts.boosts,
    status: opts.status || '',
    moves: set.moves.filter((m): m is string => !!m) as MoveName[],
    curHP:
      opts.curHPPercent !== undefined
        ? Math.max(1, Math.floor((stats.hp * opts.curHPPercent) / 100))
        : undefined,
  });

  // Champions SP spread, kept for SP-aware calc descriptions (see runCalc).
  (pokemon as Pokemon & { championsSP?: typeof set.sp }).championsSP = { ...set.sp };
  return pokemon;
}

export function buildField(opts: FieldOptions = {}): Field {
  return new Field({
    gameType: opts.gameType ?? 'Doubles',
    weather: opts.weather,
    terrain: opts.terrain,
    attackerSide: opts.attackerSide,
    defenderSide: opts.defenderSide,
  });
}

export interface DamageResult {
  /** e.g. "50.2 - 59.4%" */
  percentRange: string;
  minPercent: number;
  maxPercent: number;
  rolls: number[];
  /** e.g. "guaranteed 2HKO" */
  koChance: string;
  /** Full one-line description from the calc, ready for "copy calc". */
  description: string;
  raw: Result;
}

export function runCalc(
  attacker: Pokemon,
  defender: Pokemon,
  moveName: string,
  field: Field = buildField(),
  moveOptions: { isCrit?: boolean; hits?: number } = {},
): DamageResult {
  const move = new Move(GEN, moveName, {
    isCrit: moveOptions.isCrit,
    hits: moveOptions.hits,
  });
  const result = calculate(GEN, attacker, defender, move, field);

  const damage = ([] as number[]).concat(...([result.damage].flat() as number[]));
  const maxHP = defender.maxHP();
  const min = damage.length ? Math.min(...damage) : 0;
  const max = damage.length ? Math.max(...damage) : 0;
  const minPercent = Math.round((min / maxHP) * 1000) / 10;
  const maxPercent = Math.round((max / maxHP) * 1000) / 10;

  let koChance = '';
  let description = '';
  try {
    description = spDescription(result.fullDesc('%', false), attacker, defender);
    koChance = result.kochance().text ?? '';
  } catch {
    // Status moves / zero-damage results have no KO chance.
  }

  return {
    percentRange: `${minPercent} - ${maxPercent}%`,
    minPercent,
    maxPercent,
    rolls: damage,
    koChance,
    description,
    raw: result,
  };
}

/**
 * The library prints spreads in EV terms ("0 Atk … vs. 0 HP / 0 Def …"),
 * which is meaningless under overridden bases — rewrite them as SP values.
 */
function spDescription(desc: string, attacker: Pokemon, defender: Pokemon): string {
  const atkSP = (attacker as Pokemon & { championsSP?: SPSpread }).championsSP;
  const defSP = (defender as Pokemon & { championsSP?: SPSpread }).championsSP;
  let out = desc;
  if (atkSP) {
    out = out.replace(/^(\d+)([+-]?) (Atk|SpA) /, (_m, _n, _sign, stat: string) => {
      const sp = stat === 'Atk' ? atkSP.atk : atkSP.spa;
      return `${sp} SP ${stat} `;
    });
  }
  if (defSP) {
    out = out.replace(
      /vs\. (\d+) HP \/ (\d+)([+-]?) (Def|SpD)/,
      (_m, _hp, _n, _sign, stat: string) => {
        const sp = stat === 'Def' ? defSP.def : defSP.spd;
        return `vs. ${defSP.hp} SP HP / ${sp} SP ${stat}`;
      },
    );
  }
  return out;
}

/** Convenience: full calc straight from two sets. */
export function calcSets(
  attackerSet: ChampionsSet,
  defenderSet: ChampionsSet,
  moveName: string,
  fieldOpts: FieldOptions = {},
  attackerOpts: CalcPokemonOptions = {},
  defenderOpts: CalcPokemonOptions = {},
): DamageResult {
  return runCalc(
    toCalcPokemon(attackerSet, attackerOpts),
    toCalcPokemon(defenderSet, defenderOpts),
    moveName,
    buildField(fieldOpts),
  );
}
