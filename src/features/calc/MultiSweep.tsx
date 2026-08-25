/**
 * Multi-target OHKO sweep (Calc › Sweep): "who OHKOs Tyranitar AND Kingambit?"
 * Sweeps every regulation forme at max offensive investment against up to four
 * usage-seeded targets and ranks attackers by their WEAKEST matchup, so the
 * top of the list answers the whole core. Same semantics as the dex OHKO
 * sweep: practical moves headline, itemless attackers, current game mode.
 */
import { useMemo, useRef, useState } from 'react';
import { useSettings } from '../../app/settings';
import { Button } from '../../app/ui/Button';
import { Panel } from '../../app/ui/Panel';
import { SearchSelect } from '../../app/ui/SearchSelect';
import { Sprite } from '../../app/ui/Sprite';
import { POKEMON_TYPES, TypeBadge } from '../../app/ui/TypeBadge';
import type { DexAbility, DexLookup, DexSpecies } from '../../data/dex';
import { useUsage } from '../../data/useUsage';
import type { ChampionsSet } from '../../engine/types';
import {
  maxAttackerSet,
  prepareDefender,
  sweepOne,
  type OhkoEntry,
  type OhkoMoveOption,
} from '../analysis/ohkoSweep';
import { usageMonToSet } from '../meta/threatSet';
import { useCalc } from './calcStore';
import { speciesToSet } from './jumpToCalc';

const MAX_TARGETS = 4;
const CHUNK = 15;

interface SweepRowData {
  name: string;
  spriteId: string;
  cells: (OhkoEntry | null)[]; // per target, null = no damaging answer
  /** ranking score: ALL mode = weakest matchup, ANY mode = best matchup */
  score: number;
}

export function MultiSweep({
  lookup,
  onVerified,
}: {
  lookup: DexLookup;
  /** called after a cell is loaded into the matchup calc (switch screens) */
  onVerified: () => void;
}) {
  const usage = useUsage();
  const calc = useCalc();
  const { gameMode } = useSettings();

  const [targets, setTargets] = useState<DexSpecies[]>([]);
  const [query, setQuery] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<SweepRowData[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [matchMode, setMatchMode] = useState<'all' | 'any'>('all');
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterAbility, setFilterAbility] = useState<DexAbility | undefined>();
  const token = useRef(0);

  const resetResults = () => {
    token.current++;
    setRows(null);
    setRunning(false);
    setProgress(0);
    setShowAll(false);
  };

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ranked = [...lookup.species].sort((a, b) => {
      const ra = usage?.get(a.name)?.rank ?? Infinity;
      const rb = usage?.get(b.name)?.rank ?? Infinity;
      return ra - rb || a.name.localeCompare(b.name);
    });
    return ranked
      .filter((s) => !targets.some((t) => t.name === s.name))
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .slice(0, 30);
  }, [lookup, usage, query, targets]);

  const targetSet = (sp: DexSpecies): ChampionsSet => {
    const mon = usage?.get(sp.name);
    return (mon && usageMonToSet(mon, lookup)) || speciesToSet(sp, lookup);
  };

  const run = async () => {
    const t = ++token.current;
    setRunning(true);
    setRows(null);
    setProgress(0);

    const defenders = targets.map((sp) => ({
      species: sp,
      pokemon: prepareDefender(targetSet(sp)),
      types: [...sp.types],
    }));
    // Attacker filters apply BEFORE the sweep — a filtered run is near-instant.
    const attackers = lookup.species
      .filter((s) => !targets.some((tg) => tg.name === s.name))
      .filter((s) =>
        filterTypes.every((ft) => s.types.some((st) => st.toLowerCase() === ft)),
      )
      .filter((s) => !filterAbility || s.abilities.includes(filterAbility.name));
    const found: SweepRowData[] = [];

    for (let i = 0; i < attackers.length; i += CHUNK) {
      if (token.current !== t) return;
      for (const attacker of attackers.slice(i, i + CHUNK)) {
        const ladderMoves =
          usage?.get(attacker.name)?.moves.slice(0, 10).map(([name]) => name) ?? [];
        const cells = defenders.map((d) =>
          sweepOne(attacker, d.pokemon, d.types, lookup, { gameType: gameMode }, ladderMoves),
        );
        const pcts = cells.map((c) => c?.maxPercent ?? 0);
        const score = matchMode === 'all' ? Math.min(...pcts) : Math.max(...pcts);
        if (score >= 85) {
          found.push({ name: attacker.name, spriteId: attacker.spriteId, cells, score });
        }
      }
      setProgress(Math.min(100, Math.round(((i + CHUNK) / attackers.length) * 100)));
      await new Promise((r) => setTimeout(r, 0));
    }

    if (token.current !== t) return;
    found.sort((a, b) => b.score - a.score);
    setRows(found);
    setRunning(false);
  };

  /** Load one cell's exact matchup into the Matchup screen for verification. */
  const verify = (row: SweepRowData, targetIdx: number, option?: OhkoMoveOption) => {
    const cell = row.cells[targetIdx];
    const attackerSpecies = lookup.getSpecies(row.name);
    if (!cell || !attackerSpecies) return;
    const pick = option ?? cell;
    const set = maxAttackerSet(attackerSpecies, pick.category);
    set.moves = [pick.move];
    calc.patch({
      attacker: {
        set,
        sourceLabel: `max offense (${pick.category === 'Physical' ? 'Adamant 32 Atk' : 'Modest 32 SpA'})`,
        fromTeam: false,
      },
      defender: {
        set: structuredClone(targetSet(targets[targetIdx])),
        sourceLabel: 'meta set',
        fromTeam: false,
      },
      customMove: null,
      expandedMove: null,
    });
    onVerified();
  };

  const ohkoAll = rows?.filter((r) => r.score >= 100) ?? [];
  const close = rows?.filter((r) => r.score < 100) ?? [];
  const shownAll = showAll ? ohkoAll : ohkoAll.slice(0, 25);
  const shownClose = showAll ? close : close.slice(0, 10);

  return (
    <div className="flex flex-col gap-3">
      <Panel
        title="Targets"
        aside={<span className="label-caps">{targets.length}/{MAX_TARGETS}</span>}
      >
        {targets.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {targets.map((sp) => (
              <button
                key={sp.id}
                onClick={() => {
                  setTargets(targets.filter((x) => x.name !== sp.name));
                  setRows(null);
                }}
                className="chamfer-sm flex items-center gap-1.5 border border-gold-600/50 bg-gold-950 px-2 py-1 font-display text-xs font-semibold tracking-wide uppercase text-gold-300"
                title="Remove target"
              >
                <Sprite spriteId={sp.spriteId} size={22} />
                {sp.name} ✕
              </button>
            ))}
          </div>
        )}
        {targets.length < MAX_TARGETS && (
          <>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Add a target (usage-ranked)…"
              className="mb-1 min-h-10 w-full border border-ink-700 bg-ink-850 px-2.5 text-sm outline-none placeholder:text-ink-500 focus:border-gold-600"
            />
            <ul className="max-h-48 overflow-y-auto">
              {options.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => {
                      setTargets([...targets, s]);
                      setQuery('');
                      setRows(null);
                    }}
                    className="flex w-full items-center gap-2.5 border-b border-ink-800/60 px-1 py-1.5 text-left hover:bg-ink-850"
                  >
                    <Sprite spriteId={s.spriteId} size={28} />
                    <span className="flex-1 font-display text-sm font-semibold tracking-wide uppercase">
                      {s.name}
                    </span>
                    {usage?.get(s.name) && (
                      <span className="stat-num text-xs text-ink-500">
                        {((usage.get(s.name)?.usage ?? 0) * 100).toFixed(1)}%
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      {targets.length > 0 && (
        <Panel title="Attacker filters" aside={<span className="label-caps">optional</span>}>
          <div className="flex flex-col gap-2.5">
            {targets.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="label-caps w-16">Must KO</span>
                {(
                  [
                    ['all', 'All targets'],
                    ['any', 'Any target'],
                  ] as ['all' | 'any', string][]
                ).map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMatchMode(m);
                      resetResults();
                    }}
                    className={`chamfer-sm px-2 py-1 font-display text-xs font-semibold tracking-[0.1em] uppercase ${
                      matchMode === m
                        ? 'bg-gold-500 text-ink-950'
                        : 'border border-ink-700 text-ink-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-start gap-1.5">
              <span className="label-caps w-16 pt-1">Type</span>
              <div className="flex flex-1 flex-wrap gap-1">
                {POKEMON_TYPES.map((pt) => (
                  <button
                    key={pt}
                    onClick={() => {
                      setFilterTypes(
                        filterTypes.includes(pt)
                          ? filterTypes.filter((x) => x !== pt)
                          : [...filterTypes, pt],
                      );
                      resetResults();
                    }}
                    className={filterTypes.includes(pt) ? '' : 'opacity-40'}
                  >
                    <TypeBadge type={pt} size="sm" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="label-caps w-16">Ability</span>
              <div className="flex-1">
                <SearchSelect<DexAbility>
                  value={filterAbility}
                  placeholder="Any ability"
                  options={lookup.abilities}
                  keyOf={(a) => a.id}
                  filter={(a, q2) => a.name.toLowerCase().includes(q2)}
                  renderValue={(a) => <span>{a.name}</span>}
                  renderOption={(a) => (
                    <span className="flex flex-col">
                      <span>{a.name}</span>
                      {a.shortDesc && (
                        <span className="text-xs text-ink-500">{a.shortDesc}</span>
                      )}
                    </span>
                  )}
                  onSelect={(a) => {
                    setFilterAbility(a);
                    resetResults();
                  }}
                  onClear={() => {
                    setFilterAbility(undefined);
                    resetResults();
                  }}
                />
              </div>
            </div>
          </div>
        </Panel>
      )}

      {targets.length > 0 && rows === null && (
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={run} disabled={running}>
            {running
              ? `Sweeping… ${progress}%`
              : `Who OHKOs ${
                  targets.length === 1
                    ? 'it'
                    : matchMode === 'all'
                      ? `all ${targets.length}`
                      : 'any of them'
                }?`}
          </Button>
          {running && (
            <div className="h-1.5 flex-1 bg-ink-800">
              <div className="h-full bg-gold-500" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}

      {rows !== null && (
        <Panel
          title={`OHKOs ${
            targets.length === 1
              ? targets[0].name
              : matchMode === 'all'
                ? `all ${targets.length} targets`
                : 'at least one target'
          }`}
          aside={<span className="stat-num text-xs text-illegal">{ohkoAll.length} can</span>}
        >
          <div className="flex flex-col gap-1">
            {ohkoAll.length === 0 && (
              <p className="text-sm text-legal">
                Nothing matching the filters OHKOs{' '}
                {matchMode === 'all' ? 'every target' : 'any target'} at max itemless
                investment — see the closest below.
              </p>
            )}
            {shownAll.map((r) => (
              <MultiRow key={r.name} row={r} targets={targets} onVerify={verify} danger />
            ))}
            {close.length > 0 && (
              <>
                <p className="label-caps mt-2">Close (weakest matchup 85–99%)</p>
                {shownClose.map((r) => (
                  <MultiRow key={r.name} row={r} targets={targets} onVerify={verify} />
                ))}
              </>
            )}
            {!showAll && ohkoAll.length + close.length > shownAll.length + shownClose.length && (
              <button
                onClick={() => setShowAll(true)}
                className="label-caps mt-1 self-start text-gold-400"
              >
                Show all {ohkoAll.length + close.length} ▾
              </button>
            )}
            <p className="mt-2 text-xs text-ink-500">
              Attackers at 32 SP +nature, no item, best practical learnset move per target
              ({gameMode.toLowerCase()}). Targets use their top ladder spread. Tap a cell to
              verify that exact line in the Matchup calc.
            </p>
          </div>
        </Panel>
      )}
    </div>
  );
}

function MultiRow({
  row,
  targets,
  onVerify,
  danger,
}: {
  row: SweepRowData;
  targets: DexSpecies[];
  onVerify: (row: SweepRowData, targetIdx: number, option?: OhkoMoveOption) => void;
  danger?: boolean;
}) {
  return (
    <div className="border-b border-ink-800/40 py-1.5 last:border-0">
      <div className="flex items-center gap-2">
        <Sprite spriteId={row.spriteId} size={28} />
        <span className="flex-1 font-display text-sm font-semibold tracking-wide uppercase">
          {row.name}
        </span>
        <span className={`stat-num text-sm ${danger ? 'text-illegal' : 'text-warn'}`}>
          {row.score}%
        </span>
      </div>
      <div className="mt-1 ml-9 flex flex-col gap-0.5">
        {row.cells.map((cell, i) => (
          <TargetCell
            key={targets[i].id}
            target={targets[i]}
            cell={cell}
            onVerify={(option) => onVerify(row, i, option)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * One target's line: the strongest PRACTICAL move headlines (same rule as the
 * dex OHKO sweep) with a +N expander listing every other qualifying move.
 */
function TargetCell({
  target,
  cell,
  onVerify,
}: {
  target: DexSpecies;
  cell: OhkoEntry | null;
  onVerify: (option?: OhkoMoveOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const extra = cell ? cell.alternatives.filter((o) => o.move !== cell.move) : [];

  return (
    <div>
      <div className="flex w-full items-center gap-1.5">
        <button
          onClick={() => onVerify()}
          disabled={!cell}
          className="flex flex-1 items-center gap-1.5 py-0.5 text-left text-xs text-ink-300 hover:bg-ink-850 disabled:opacity-50"
          title="Verify in matchup calc"
        >
          <span className="label-caps w-24 truncate">{target.name}</span>
          {cell ? (
            <>
              <TypeBadge type={cell.moveType} size="sm" />
              <span className="flex-1">{cell.move}</span>
              {cell.drawback && (
                <span className="chamfer-sm bg-warn/15 px-1 text-[0.65rem] text-warn">
                  {cell.drawback}
                </span>
              )}
              <span
                className={`stat-num ${cell.maxPercent >= 100 ? 'text-illegal' : 'text-warn'}`}
              >
                {cell.maxPercent}%
              </span>
            </>
          ) : (
            <span className="text-ink-500">no damaging answer</span>
          )}
        </button>
        {extra.length > 0 && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="label-caps shrink-0 px-1 text-ink-500 hover:text-gold-400"
            aria-label={`${extra.length} more moves vs ${target.name}`}
          >
            {open ? '▾' : `+${extra.length}`}
          </button>
        )}
      </div>
      {open && (
        <ul className="mb-1 ml-[6.75rem] flex flex-col gap-0.5">
          {extra.map((o) => (
            <li key={o.move}>
              <button
                onClick={() => onVerify(o)}
                className="flex w-full items-center gap-1.5 py-0.5 text-left text-[0.7rem] text-ink-400 hover:bg-ink-850"
                title="Verify in matchup calc"
              >
                <TypeBadge type={o.moveType} size="sm" />
                <span className="flex-1">{o.move}</span>
                {o.drawback && (
                  <span className="chamfer-sm bg-warn/15 px-1 text-[0.65rem] text-warn">
                    {o.drawback}
                  </span>
                )}
                <span
                  className={`stat-num ${o.maxPercent >= 100 ? 'text-illegal' : 'text-ink-500'}`}
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
