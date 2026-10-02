/**
 * Whole-regulation OHKO sweep runner shared by the dex/usage "Who OHKOs
 * this?" panel (one target) and Calc › Sweep (up to four targets). Chunked
 * so the UI can paint progress; a new run or reset supersedes the old one.
 */
import { useRef, useState } from 'react';
import { useSettings } from '../../app/settings';
import { useUI } from '../../app/store';
import type { DexLookup, DexSpecies } from '../../data/dex';
import { useUsage } from '../../data/useUsage';
import type { ChampionsSet } from '../../engine/types';
import { useCalc } from '../calc/calcStore';
import {
  maxAttackerSet,
  maxSpreadLabel,
  prepareDefender,
  sweepOne,
  type OhkoEntry,
  type OhkoMoveOption,
} from './ohkoSweep';

export interface SweepTarget {
  species: DexSpecies;
  set: ChampionsSet;
  /** how the defender was seeded ("meta set" / "no usage data") */
  sourceLabel: string;
}

export interface SweepRowData {
  name: string;
  spriteId: string;
  cells: (OhkoEntry | null)[]; // per target, null = no damaging answer
  /** ranking score: ALL mode = weakest matchup, ANY mode = best matchup */
  score: number;
}

export type MatchMode = 'all' | 'any';

/** rows below this max % are dropped (practical headline) */
export const KEEP_THRESHOLD = 85;

/** Single-target row whose ONLY OHKO carries a drawback (Hyper Beam & co). */
export const isDrawbackOnly = (row: SweepRowData): boolean =>
  row.cells.length === 1 &&
  row.score < KEEP_THRESHOLD &&
  (row.cells[0]?.alternatives[0]?.maxPercent ?? 0) >= 100;

export function useOhkoSweep(lookup: DexLookup) {
  const usage = useUsage();
  const { gameMode } = useSettings();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<SweepRowData[] | null>(null);
  const token = useRef(0);

  const reset = () => {
    token.current++;
    setRows(null);
    setRunning(false);
    setProgress(0);
  };

  const run = async (
    targets: SweepTarget[],
    opts: { matchMode?: MatchMode; attackerFilter?: (s: DexSpecies) => boolean; chunk?: number } = {},
  ) => {
    const t = ++token.current;
    setRunning(true);
    setRows(null);
    setProgress(0);
    const matchMode = opts.matchMode ?? 'all';
    const chunk = opts.chunk ?? 15;

    const defenders = targets.map((tg) => ({
      pokemon: prepareDefender(tg.set),
      types: [...tg.species.types],
    }));
    const targetNames = new Set(targets.map((tg) => tg.species.name));
    // Attacker filters apply BEFORE the sweep — a filtered run is near-instant.
    const attackers = lookup.species
      .filter((s) => !targetNames.has(s.name))
      .filter((s) => !opts.attackerFilter || opts.attackerFilter(s));
    const found: SweepRowData[] = [];

    for (let i = 0; i < attackers.length; i += chunk) {
      if (token.current !== t) return;
      for (const attacker of attackers.slice(i, i + chunk)) {
        // The attacker's REAL ladder moves are always verified, so the
        // heuristic can't hide what it actually clicks (e.g. Earth Power).
        const ladderMoves =
          usage?.get(attacker.name)?.moves.slice(0, 10).map(([name]) => name) ?? [];
        const cells = defenders.map((d) =>
          sweepOne(attacker, d.pokemon, d.types, lookup, { gameType: gameMode }, ladderMoves),
        );
        const pcts = cells.map((c) => c?.maxPercent ?? 0);
        const score = matchMode === 'all' ? Math.min(...pcts) : Math.max(...pcts);
        const row = { name: attacker.name, spriteId: attacker.spriteId, cells, score };
        if (score >= KEEP_THRESHOLD || isDrawbackOnly(row)) found.push(row);
      }
      setProgress(Math.min(100, Math.round(((i + chunk) / attackers.length) * 100)));
      await new Promise((r) => setTimeout(r, 0)); // let the UI breathe
    }

    if (token.current !== t) return;
    found.sort((a, b) => b.score - a.score);
    setRows(found);
    setRunning(false);
  };

  return { rows, running, progress, run, reset, gameMode };
}

/** Load one cell's exact matchup into the Matchup calc for verification. */
export function useVerifyInCalc(lookup: DexLookup) {
  const calc = useCalc();
  const { openCalc } = useUI();
  return (row: SweepRowData, target: SweepTarget, targetIdx: number, option?: OhkoMoveOption) => {
    const cell = row.cells[targetIdx];
    const attackerSpecies = lookup.getSpecies(row.name);
    if (!cell || !attackerSpecies) return;
    const pick = option ?? cell;
    const set = maxAttackerSet(attackerSpecies, pick.category, lookup);
    set.moves = [pick.move];
    calc.patch({
      attacker: { set, sourceLabel: `max offense (${maxSpreadLabel(pick.category)})`, fromTeam: false },
      defender: { set: structuredClone(target.set), sourceLabel: target.sourceLabel, fromTeam: false },
      customMove: null,
      expandedMove: null,
    });
    openCalc('matchup');
  };
}
