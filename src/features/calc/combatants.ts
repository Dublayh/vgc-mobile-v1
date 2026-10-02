/**
 * The calc store's field + boosts/status turned into @smogon/calc inputs.
 * Lives apart from calcStore so the (lazy) calc engine stays out of the main
 * chunk — calcStore is imported by main-chunk screens via useJumpToCalc.
 */
import { buildField, toCalcPokemon } from '../../engine/calc';
import type { CalcSelection, CalcState } from './calcStore';

export function fieldFromState(s: CalcState) {
  return buildField({
    gameType: s.gameType,
    weather: s.weather,
    terrain: s.terrain,
    attackerSide: { isHelpingHand: s.helpingHand },
    defenderSide: {
      isReflect: s.screens.reflect,
      isLightScreen: s.screens.lightScreen,
      isAuroraVeil: s.screens.auroraVeil,
      isFriendGuard: s.friendGuard,
    },
  });
}

export const attackerPokemon = (s: CalcState, sel: CalcSelection) =>
  toCalcPokemon(sel.set, {
    formeName: sel.set.megaStone,
    boosts: s.attackerBoosts,
    status: s.attackerBurned ? 'brn' : '',
  });

export const partnerPokemon = (s: CalcState, sel: CalcSelection) =>
  toCalcPokemon(sel.set, { formeName: sel.set.megaStone, boosts: s.attacker2Boosts });

export const defenderPokemon = (s: CalcState, sel: CalcSelection) =>
  toCalcPokemon(sel.set, { formeName: sel.set.megaStone, boosts: s.defenderBoosts });

export function combatantsFromState(s: CalcState, attacker: CalcSelection, defender: CalcSelection) {
  return { field: fieldFromState(s), atk: attackerPokemon(s, attacker), def: defenderPokemon(s, defender) };
}
