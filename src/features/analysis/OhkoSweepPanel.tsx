/**
 * "Who OHKOs this?" — sweeps the ENTIRE regulation (every forme, mega included)
 * against one defender. Attackers are modeled at max offensive potential
 * (32 SP, +nature, no item, best learnset move). Chunked so the UI stays
 * responsive; every row jumps into the Calc for verification.
 */
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../app/settings';
import { useUI } from '../../app/store';
import { Button } from '../../app/ui/Button';
import { Panel } from '../../app/ui/Panel';
import { Sprite } from '../../app/ui/Sprite';
import { TypeBadge } from '../../app/ui/TypeBadge';
import type { DexLookup } from '../../data/dex';
import { useUsage } from '../../data/useUsage';
import { STAT_IDS, type AlignmentName, type ChampionsSet, EMPTY_SP } from '../../engine/types';
import { useCalc } from '../calc/calcStore';
import { speciesToSet } from '../calc/jumpToCalc';
import {
  maxAttackerSet,
  prepareDefender,
  sweepOne,
  type OhkoEntry,
  type OhkoMoveOption,
} from './ohkoSweep';

const CHUNK = 20;

export function OhkoSweepPanel({
  defenderName,
  lookup,
}: {
  defenderName: string; // forme display name
  lookup: DexLookup;
}) {
  const usage = useUsage();
  const calc = useCalc();
  const { setTab } = useUI();
  const { gameMode } = useSettings();

  const species = lookup.getSpecies(defenderName);
  const mon = usage?.get(defenderName);
  const [spreadIdx, setSpreadIdx] = useState(0); // index into spread options
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<OhkoEntry[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const runToken = useRef(0);

  // Reset when the viewed mon changes.
  useEffect(() => {
    runToken.current++;
    setResults(null);
    setRunning(false);
    setProgress(0);
    setSpreadIdx(0);
    setShowAll(false);
  }, [defenderName, gameMode]);

  if (!species) return null;

  const spreadOptions: { label: string; alignment: AlignmentName; sp: ChampionsSet['sp'] }[] = [
    ...(mon?.spreads.slice(0, 3).map((s) => ({
      label: `${s.alignment} ${STAT_IDS.filter((id) => s.sp[id] > 0)
        .map((id) => s.sp[id])
        .join('/')}`,
      alignment: s.alignment as AlignmentName,
      sp: { ...s.sp },
    })) ?? []),
    { label: '0 SP', alignment: 'Serious' as AlignmentName, sp: { ...EMPTY_SP } },
  ];
  const spread = spreadOptions[Math.min(spreadIdx, spreadOptions.length - 1)];

  const defenderSet: ChampionsSet = {
    ...speciesToSet(species, lookup),
    alignment: spread.alignment,
    sp: { ...spread.sp },
  };

  const run = async () => {
    const token = ++runToken.current;
    setRunning(true);
    setResults(null);
    setProgress(0);

    const defender = prepareDefender(defenderSet);
    const attackers = lookup.species.filter((s) => s.name !== species.name);
    const found: OhkoEntry[] = [];

    for (let i = 0; i < attackers.length; i += CHUNK) {
      if (runToken.current !== token) return; // superseded
      for (const attacker of attackers.slice(i, i + CHUNK)) {
        // The attacker's REAL ladder moves are always verified, so the
        // heuristic can't hide what it actually clicks (e.g. Earth Power).
        const ladderMoves =
          usage?.get(attacker.name)?.moves.slice(0, 10).map(([name]) => name) ?? [];
        const entry = sweepOne(
          attacker,
          defender,
          [...species.types],
          lookup,
          { gameType: gameMode },
          ladderMoves,
        );
        // Keep practical threats ≥85%, plus mons whose ONLY OHKO is a drawback move.
        if (entry && (entry.maxPercent >= 85 || entry.alternatives[0].maxPercent >= 100)) {
          found.push(entry);
        }
      }
      setProgress(Math.min(100, Math.round(((i + CHUNK) / attackers.length) * 100)));
      await new Promise((r) => setTimeout(r, 0)); // let the UI breathe
    }

    if (runToken.current !== token) return;
    found.sort((a, b) => b.maxPercent - a.maxPercent);
    setResults(found);
    setRunning(false);
  };

  const verify = (entry: OhkoEntry, option?: OhkoMoveOption) => {
    const attackerSpecies = lookup.getSpecies(entry.name);
    if (!attackerSpecies) return;
    const pick = option ?? entry;
    const set = maxAttackerSet(attackerSpecies, pick.category);
    set.moves = [pick.move];
    const label = pick.category === 'Physical' ? 'Adamant 32 Atk' : 'Modest 32 SpA';
    calc.patch({
      attacker: { set, sourceLabel: `max offense (${label})`, fromTeam: false },
      defender: {
        set: structuredClone(defenderSet),
        sourceLabel: mon ? 'meta set' : 'no usage data',
        fromTeam: false,
      },
      customMove: null,
      expandedMove: null,
    });
    setTab('calc');
  };

  // Groups by the PRACTICAL headline; mons whose only OHKO carries a drawback
  // (Hyper Beam & friends) get their own honestly-labeled bucket.
  const ohkos = results?.filter((e) => e.maxPercent >= 100) ?? [];
  const near = results?.filter((e) => e.maxPercent < 100 && e.maxPercent >= 85) ?? [];
  const drawbackOnly =
    results?.filter((e) => e.maxPercent < 85 && e.alternatives[0].maxPercent >= 100) ?? [];
  const shownOhkos = showAll ? ohkos : ohkos.slice(0, 30);
  const shownNear = showAll ? near : near.slice(0, 10);
  const shownDrawback = showAll ? drawbackOnly : drawbackOnly.slice(0, 10);

  return (
    <Panel
      title={`Who OHKOs ${species.name}?`}
      aside={
        results !== null ? (
          <span className="stat-num text-xs text-illegal">{ohkos.length} can</span>
        ) : undefined
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="label-caps">As:</span>
        {spreadOptions.map((s, i) => (
          <button
            key={i}
            onClick={() => {
              setSpreadIdx(i);
              setResults(null);
            }}
            className={`chamfer-sm px-2 py-0.5 font-display text-[0.7rem] font-semibold tracking-[0.06em] uppercase ${
              i === Math.min(spreadIdx, spreadOptions.length - 1)
                ? 'bg-gold-500 text-ink-950'
                : 'border border-ink-700 text-ink-400'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {results === null && (
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={run} disabled={running}>
            {running ? `Sweeping… ${progress}%` : `Sweep all ${lookup.species.length} formes`}
          </Button>
          {running && (
            <div className="h-1.5 flex-1 bg-ink-800">
              <div className="h-full bg-gold-500" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}

      {results !== null && (
        <div className="flex flex-col gap-1">
          {ohkos.length === 0 && (
            <p className="text-sm text-legal">
              Nothing in the regulation OHKOs this spread at max investment (itemless).
            </p>
          )}
          {shownOhkos.map((e) => (
            <SweepRow key={e.name} entry={e} onVerify={(opt) => verify(e, opt)} danger />
          ))}
          {near.length > 0 && (
            <>
              <p className="label-caps mt-2">Near misses (85–99%)</p>
              {shownNear.map((e) => (
                <SweepRow key={e.name} entry={e} onVerify={(opt) => verify(e, opt)} />
              ))}
            </>
          )}
          {drawbackOnly.length > 0 && (
            <>
              <p className="label-caps mt-2">OHKO only with drawback moves</p>
              {shownDrawback.map((e) => (
                <SweepRow
                  key={e.name}
                  entry={e}
                  display={e.alternatives[0]}
                  onVerify={(opt) => verify(e, opt ?? e.alternatives[0])}
                />
              ))}
            </>
          )}
          {!showAll &&
            ohkos.length + near.length + drawbackOnly.length >
              shownOhkos.length + shownNear.length + shownDrawback.length && (
              <button
                onClick={() => setShowAll(true)}
                className="label-caps mt-1 self-start text-gold-400"
              >
                Show all {ohkos.length + near.length + drawbackOnly.length} ▾
              </button>
            )}
          <p className="mt-2 text-xs text-ink-500">
            Max rolls, attacker at 32 SP +nature, no item, best learnset move.
            Items (Life Orb, Choice) hit harder — verify lines in Calc.
          </p>
        </div>
      )}
    </Panel>
  );
}

function SweepRow({
  entry,
  display,
  onVerify,
  danger,
}: {
  entry: OhkoEntry;
  /** override the headline option shown (drawback-only bucket) */
  display?: OhkoMoveOption;
  onVerify: (option?: OhkoMoveOption) => void;
  danger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const head = display ?? entry;
  const extra = entry.alternatives.filter((o) => o.move !== head.move);

  return (
    <div className="border-b border-ink-800/40 last:border-0">
      <div className="flex w-full items-center gap-2 py-1.5">
        <button
          onClick={() => onVerify(display)}
          className="flex flex-1 items-center gap-2 text-left hover:bg-ink-850"
          title="Verify in calc"
        >
          <Sprite spriteId={entry.spriteId} size={28} />
          <span className="flex-1">
            <span className="font-display text-sm font-semibold tracking-wide uppercase">
              {entry.name}
            </span>
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-ink-400">
              <TypeBadge type={head.moveType} size="sm" /> {head.move}
              {head.drawback && (
                <span className="chamfer-sm bg-warn/15 px-1 text-[0.65rem] text-warn">
                  {head.drawback}
                </span>
              )}
            </span>
          </span>
          <span className={`stat-num text-sm ${danger ? 'text-illegal' : 'text-warn'}`}>
            {head.maxPercent}%
          </span>
        </button>
        {extra.length > 0 && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="label-caps shrink-0 px-1.5 text-ink-500 hover:text-gold-400"
            aria-label={`${extra.length} more moves`}
          >
            {open ? '▾' : `+${extra.length}`}
          </button>
        )}
      </div>
      {open && (
        <ul className="mb-1.5 ml-9 flex flex-col gap-0.5">
          {extra.map((o) => (
            <li key={o.move}>
              <button
                onClick={() => onVerify(o)}
                className="flex w-full items-center gap-1.5 py-0.5 text-left text-xs text-ink-300 hover:bg-ink-850"
                title="Verify in calc"
              >
                <TypeBadge type={o.moveType} size="sm" />
                <span className="flex-1">{o.move}</span>
                {o.drawback && (
                  <span className="chamfer-sm bg-warn/15 px-1 text-[0.65rem] text-warn">
                    {o.drawback}
                  </span>
                )}
                <span
                  className={`stat-num ${o.maxPercent >= 100 ? 'text-illegal' : 'text-ink-400'}`}
                >
                  {o.maxPercent}%
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
