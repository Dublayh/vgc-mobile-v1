/**
 * Shared result list for OHKO sweeps: OHKOs, near misses and (single target)
 * the honestly-labeled "only with a drawback move" bucket. Every line taps
 * through to the Matchup calc.
 */
import { useState } from 'react';
import { Sprite } from '../../app/ui/Sprite';
import { TypeBadge } from '../../app/ui/TypeBadge';
import type { OhkoEntry, OhkoMoveOption } from './ohkoSweep';
import { isDrawbackOnly, KEEP_THRESHOLD, type MatchMode, type SweepRowData, type SweepTarget } from './useOhkoSweep';

export function SweepResults({
  rows,
  targets,
  matchMode,
  onVerify,
  gameMode,
  filtered,
}: {
  rows: SweepRowData[];
  targets: SweepTarget[];
  matchMode: MatchMode;
  onVerify: (row: SweepRowData, targetIdx: number, option?: OhkoMoveOption) => void;
  gameMode: 'Doubles' | 'Singles';
  /** attacker filters were applied (wording only) */
  filtered?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const single = targets.length === 1;
  const ohkos = rows.filter((r) => r.score >= 100);
  const near = rows.filter((r) => r.score < 100 && r.score >= KEEP_THRESHOLD);
  const drawback = single ? rows.filter(isDrawbackOnly) : [];
  const cap = <T,>(list: T[], n: number) => (showAll ? list : list.slice(0, n));
  const shownOhkos = cap(ohkos, 30);
  const shownNear = cap(near, 10);
  const shownDrawback = cap(drawback, 10);
  const total = ohkos.length + near.length + drawback.length;
  const shownTotal = shownOhkos.length + shownNear.length + shownDrawback.length;

  return (
    <div className="flex flex-col gap-1">
      {ohkos.length === 0 && (
        <p className="text-sm text-legal">
          Nothing {filtered ? 'matching the filters' : 'in the regulation'} OHKOs{' '}
          {single ? 'this spread' : matchMode === 'all' ? 'every target' : 'any target'} at max
          itemless investment{near.length > 0 ? ' — see the closest below' : ''}.
        </p>
      )}
      {shownOhkos.map((r) => (
        <SweepRow key={r.name} row={r} targets={targets} onVerify={onVerify} danger />
      ))}
      {near.length > 0 && (
        <>
          <p className="label-caps mt-2">
            {single ? 'Near misses (85–99%)' : 'Close (weakest matchup 85–99%)'}
          </p>
          {shownNear.map((r) => (
            <SweepRow key={r.name} row={r} targets={targets} onVerify={onVerify} />
          ))}
        </>
      )}
      {drawback.length > 0 && (
        <>
          <p className="label-caps mt-2">OHKO only with drawback moves</p>
          {shownDrawback.map((r) => (
            <SweepRow
              key={r.name}
              row={r}
              targets={targets}
              onVerify={onVerify}
              display={r.cells[0]!.alternatives[0]}
            />
          ))}
        </>
      )}
      {!showAll && total > shownTotal && (
        <button onClick={() => setShowAll(true)} className="label-caps mt-1 self-start text-gold-400">
          Show all {total} ▾
        </button>
      )}
      <p className="mt-2 text-xs text-ink-500">
        Max rolls: attackers at 32 SP +nature, no item, best practical learnset move per target (
        {gameMode.toLowerCase()}). Targets use their top ladder set
        {single ? ' with the spread picked above' : ''}. Items (Life Orb, Choice) hit harder — tap a
        line to verify it in the Matchup calc.
      </p>
    </div>
  );
}

function SweepRow({
  row,
  targets,
  onVerify,
  danger,
  display,
}: {
  row: SweepRowData;
  targets: SweepTarget[];
  onVerify: (row: SweepRowData, targetIdx: number, option?: OhkoMoveOption) => void;
  danger?: boolean;
  /** override the headline option shown (drawback-only bucket) */
  display?: OhkoMoveOption;
}) {
  const single = targets.length === 1;
  const headline = single ? (display ?? row.cells[0]) : null;
  return (
    <div className="border-b border-ink-800/40 py-1.5 last:border-0">
      <div className="flex items-center gap-2">
        <Sprite spriteId={row.spriteId} size={28} />
        <span className="flex-1 font-display text-sm font-semibold tracking-wide uppercase">
          {row.name}
        </span>
        <span className={`stat-num text-sm ${danger ? 'text-illegal' : 'text-warn'}`}>
          {headline ? headline.maxPercent : row.score}%
        </span>
      </div>
      <div className="mt-1 ml-9 flex flex-col gap-0.5">
        {row.cells.map((cell, i) => (
          <TargetCell
            key={targets[i].species.id}
            label={single ? undefined : targets[i].species.name}
            cell={cell}
            display={i === 0 ? display : undefined}
            onVerify={(option) => onVerify(row, i, option)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * One target's line: the strongest PRACTICAL move headlines with a +N
 * expander listing every other qualifying move.
 */
function TargetCell({
  label,
  cell,
  display,
  onVerify,
}: {
  label?: string;
  cell: OhkoEntry | null;
  display?: OhkoMoveOption;
  onVerify: (option?: OhkoMoveOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const head = display ?? cell;
  const extra = cell && head ? cell.alternatives.filter((o) => o.move !== head.move) : [];

  return (
    <div>
      <div className="flex w-full items-center gap-1.5">
        <button
          onClick={() => onVerify(display)}
          disabled={!cell}
          className="flex flex-1 items-center gap-1.5 py-0.5 text-left text-xs text-ink-300 hover:bg-ink-850 disabled:opacity-50"
          title="Verify in matchup calc"
        >
          {label && <span className="label-caps w-24 truncate">{label}</span>}
          {head ? (
            <>
              <TypeBadge type={head.moveType} size="sm" />
              <span className="flex-1">{head.move}</span>
              {head.drawback && <Drawback text={head.drawback} />}
              <span className={`stat-num ${head.maxPercent >= 100 ? 'text-illegal' : 'text-warn'}`}>
                {head.maxPercent}%
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
            aria-label={`${extra.length} more moves${label ? ` vs ${label}` : ''}`}
          >
            {open ? '▾' : `+${extra.length}`}
          </button>
        )}
      </div>
      {open && (
        <ul className={`mb-1 flex flex-col gap-0.5 ${label ? 'ml-[6.75rem]' : 'ml-1'}`}>
          {extra.map((o) => (
            <li key={o.move}>
              <button
                onClick={() => onVerify(o)}
                className="flex w-full items-center gap-1.5 py-0.5 text-left text-[0.7rem] text-ink-400 hover:bg-ink-850"
                title="Verify in matchup calc"
              >
                <TypeBadge type={o.moveType} size="sm" />
                <span className="flex-1">{o.move}</span>
                {o.drawback && <Drawback text={o.drawback} />}
                <span className={`stat-num ${o.maxPercent >= 100 ? 'text-illegal' : 'text-ink-500'}`}>
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

const Drawback = ({ text }: { text: string }) => (
  <span className="chamfer-sm bg-warn/15 px-1 text-[0.65rem] text-warn">{text}</span>
);
