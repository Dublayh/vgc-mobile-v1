/**
 * OHKO sweep: "who in the whole regulation can OHKO this mon?"
 * Every attacker is modeled at MAXIMUM offensive potential — 32 SP with a
 * +nature in the attacking stat, no item — and its strongest learnset move
 * (heuristically pre-ranked by BP × effectiveness × STAB, then verified with
 * real calcs). Numbers are max rolls; doubles spread penalty applies when
 * gameType is Doubles.
 */
import type { DexLookup, DexMove, DexSpecies } from '../../data/dex';
import { buildField, runCalc, toCalcPokemon } from '../../engine/calc';
import { effectiveness } from '../../engine/typechart';
import { EMPTY_SP, type ChampionsSet } from '../../engine/types';

export interface OhkoMoveOption {
  move: string;
  moveType: string;
  category: 'Physical' | 'Special';
  maxPercent: number;
  /** "recharge" / "charge turn" / "self-KO" / … — a move you wouldn't really click */
  drawback?: string;
}

export interface OhkoEntry extends OhkoMoveOption {
  name: string; // attacker forme display name
  spriteId: string;
  spreadLabel: string; // e.g. "Adamant 32 Atk"
  /** every verified damaging option, sorted by max %, headline included */
  alternatives: OhkoMoveOption[];
}

export interface OhkoOptions {
  gameType?: 'Doubles' | 'Singles';
  /** verified moves per attacker after heuristic pre-ranking */
  movesPerAttacker?: number;
  /** alternatives below this max % are dropped (headline always kept) */
  keepThreshold?: number;
}

export function maxAttackerSet(
  species: DexSpecies,
  category: 'Physical' | 'Special',
): ChampionsSet {
  return {
    species: species.baseSpecies ?? species.name,
    ...(species.baseSpecies ? { megaStone: species.name } : {}),
    ability: species.abilities[0] ?? '',
    alignment: category === 'Physical' ? 'Adamant' : 'Modest',
    sp: { ...EMPTY_SP, [category === 'Physical' ? 'atk' : 'spa']: 32 },
    moves: [],
  };
}

/**
 * Best verified entry for one attacker vs. the prepared defender, or null.
 * `mustVerifyMoves` (the mon's real ladder moves, from usage stats) are always
 * calc-verified even when the BP×eff heuristic would rank them out — coverage
 * a mon never runs must not crowd out the moves it actually clicks.
 */
export function sweepOne(
  attacker: DexSpecies,
  defender: ReturnType<typeof toCalcPokemon>,
  defenderTypes: string[],
  lookup: DexLookup,
  opts: OhkoOptions = {},
  mustVerifyMoves: string[] = [],
): OhkoEntry | null {
  const field = buildField({ gameType: opts.gameType ?? 'Doubles' });

  // Heuristic pre-rank: BP × type effectiveness × STAB.
  const ranked = attacker.learnset
    .map((id) => lookup.getMove(id))
    .filter((m): m is DexMove => !!m && m.category !== 'Status' && m.basePower > 0)
    .map((m) => ({
      move: m,
      score:
        m.basePower *
        effectiveness(m.type, defenderTypes) *
        (attacker.types.includes(m.type) ? 1.5 : 1),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.movesPerAttacker ?? 10);

  const candidates = [...ranked];
  const seen = new Set(ranked.map((c) => c.move.id));
  for (const name of mustVerifyMoves) {
    const m = lookup.getMove(name);
    if (m && m.category !== 'Status' && m.basePower > 0 && !seen.has(m.id)) {
      if (effectiveness(m.type, defenderTypes) > 0) candidates.push({ move: m, score: 0 });
      seen.add(m.id);
    }
  }

  const options: OhkoMoveOption[] = [];
  const pokemonByCategory: Partial<Record<'Physical' | 'Special', ReturnType<typeof toCalcPokemon>>> = {};

  for (const { move } of candidates) {
    const category = move.category as 'Physical' | 'Special';
    try {
      pokemonByCategory[category] ??= toCalcPokemon(maxAttackerSet(attacker, category), {
        formeName: attacker.baseSpecies ? attacker.name : undefined,
      });
      const result = runCalc(pokemonByCategory[category]!, defender, move.name, field);
      if (result.maxPercent > 0) {
        options.push({
          move: move.name,
          moveType: move.type,
          category,
          maxPercent: result.maxPercent,
          ...(move.drawback ? { drawback: move.drawback } : {}),
        });
      }
    } catch {
      // move unknown to calc data — skip
    }
  }
  if (options.length === 0) return null;
  options.sort((a, b) => b.maxPercent - a.maxPercent);

  // Headline = strongest PRACTICAL move; drawback moves (Hyper Beam, Focus
  // Punch, Explosion…) only headline when nothing practical damages at all.
  // They stay visible — tagged — in `alternatives`.
  const headline = options.find((o) => !o.drawback) ?? options[0];

  // The dropdown only lists moves that matter: OHKOs and near-misses
  // (≥ keepThreshold), never a mon's whole filler movepool.
  const threshold = opts.keepThreshold ?? 85;
  const alternatives = options.filter((o) => o.maxPercent >= threshold || o === headline);

  return {
    name: attacker.name,
    spriteId: attacker.spriteId,
    ...headline,
    spreadLabel: headline.category === 'Physical' ? 'Adamant 32 Atk' : 'Modest 32 SpA',
    alternatives,
  };
}

export function prepareDefender(defenderSet: ChampionsSet) {
  return toCalcPokemon(defenderSet, { formeName: defenderSet.megaStone });
}
