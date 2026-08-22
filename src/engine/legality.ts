/**
 * Regulation legality — pure functions over the dex bundle + regulation data.
 * UI surfaces these as ambient badges (never blocking modals, per plan §4).
 */
import { validateSP } from './stats';
import type { ChampionsSet, Team } from './types';

export interface Violation {
  code:
    | 'species-not-allowed'
    | 'mega-not-allowed'
    | 'ability-mismatch'
    | 'item-banned'
    | 'item-illegal'
    | 'move-illegal'
    | 'move-duplicate'
    | 'sp-invalid'
    | 'species-clause'
    | 'item-clause';
  message: string;
  /** slot index within the team, when reported at team level */
  slot?: number;
}

/** The slice of dex/regulation data legality needs (kept minimal for testing). */
export interface LegalityContext {
  allowedSpecies: Set<string>;
  /** species name → allowed mega forme names */
  megaFormes: Map<string, string[]>;
  bannedItems: Set<string>;
  /** the full Champions item pool; null = unknown (skip existence check) */
  legalItems?: Set<string> | null;
  clauses: string[];
  /** species name → learnset move ids; absent species = unknown (skip move check) */
  learnsets: Map<string, Set<string>>;
  /** species name → legal abilities */
  abilities: Map<string, string[]>;
  /** move name/id normalizer (Showdown id) */
  moveId: (name: string) => string;
}

export function setViolations(set: ChampionsSet, ctx: LegalityContext): Violation[] {
  const v: Violation[] = [];

  if (!ctx.allowedSpecies.has(set.species)) {
    v.push({
      code: 'species-not-allowed',
      message: `${set.species} is not legal in this regulation`,
    });
  }

  if (set.megaStone) {
    const formes = ctx.megaFormes.get(set.species) ?? [];
    if (!formes.includes(set.megaStone)) {
      v.push({
        code: 'mega-not-allowed',
        message: `${set.species} cannot mega evolve into ${set.megaStone} in this regulation`,
      });
    }
  }

  // A mega set's ability may be stored as either the base forme's or the mega
  // forme's (usage stats track megas by their fixed ability) — both are legal.
  const abilityPool = [
    ...(ctx.abilities.get(set.species) ?? []),
    ...(set.megaStone ? (ctx.abilities.get(set.megaStone) ?? []) : []),
  ];
  if (set.ability && abilityPool.length && !abilityPool.includes(set.ability)) {
    v.push({
      code: 'ability-mismatch',
      message: `${set.megaStone ?? set.species} cannot have ${set.ability}`,
    });
  }

  if (set.item && ctx.bannedItems.has(set.item)) {
    v.push({ code: 'item-banned', message: `${set.item} is banned` });
  }

  if (set.item && ctx.legalItems && !ctx.legalItems.has(set.item)) {
    v.push({
      code: 'item-illegal',
      message: `${set.item} does not exist in Champions`,
    });
  }

  const learnset = ctx.learnsets.get(set.species);
  const seen = new Set<string>();
  for (const move of set.moves) {
    if (!move) continue;
    const id = ctx.moveId(move);
    if (seen.has(id)) {
      v.push({ code: 'move-duplicate', message: `${move} appears twice` });
    }
    seen.add(id);
    if (learnset && !learnset.has(id)) {
      v.push({ code: 'move-illegal', message: `${set.species} cannot learn ${move}` });
    }
  }

  const sp = validateSP(set.sp);
  if (!sp.valid) {
    v.push({ code: 'sp-invalid', message: `SP spread invalid: ${sp.errors[0]}` });
  }

  return v;
}

export function teamViolations(team: Team, ctx: LegalityContext): Violation[] {
  const v: Violation[] = [];

  team.sets.forEach((set, slot) => {
    for (const sv of setViolations(set, ctx)) v.push({ ...sv, slot });
  });

  if (ctx.clauses.includes('species')) {
    const bySpecies = new Map<string, number[]>();
    team.sets.forEach((s, i) => {
      bySpecies.set(s.species, [...(bySpecies.get(s.species) ?? []), i]);
    });
    for (const [species, slots] of bySpecies) {
      if (slots.length > 1) {
        v.push({
          code: 'species-clause',
          message: `Species clause: ${species} appears ${slots.length} times`,
          slot: slots[1],
        });
      }
    }
  }

  if (ctx.clauses.includes('item')) {
    const byItem = new Map<string, number[]>();
    team.sets.forEach((s, i) => {
      if (s.item) byItem.set(s.item, [...(byItem.get(s.item) ?? []), i]);
    });
    for (const [item, slots] of byItem) {
      if (slots.length > 1) {
        v.push({
          code: 'item-clause',
          message: `Item clause: ${item} appears ${slots.length} times`,
          slot: slots[1],
        });
      }
    }
  }

  return v;
}
