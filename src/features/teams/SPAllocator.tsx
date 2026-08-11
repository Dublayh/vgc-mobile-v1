import { useRef } from 'react';
import { computeStats } from '../../engine/stats';
import {
  ALIGNMENTS,
  type AlignmentName,
  EMPTY_SP,
  SP_POOL,
  SP_STAT_MAX,
  type SPSpread,
  STAT_IDS,
  STAT_LABELS,
  type StatID,
  type StatsTable,
} from '../../engine/types';

/** Press-and-hold stepper repeat (plan §4: "steppers with long-press repeat"). */
function useRepeat(fn: (delta: 1 | -1) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const start = (delta: 1 | -1) => {
    fn(delta);
    const tick = (interval: number) => {
      timer.current = setTimeout(() => {
        fn(delta);
        tick(Math.max(45, interval * 0.85)); // accelerate
      }, interval);
    };
    tick(400);
  };
  return { start, stop };
}

const PRESETS: { label: string; sp: (base: StatsTable) => SPSpread }[] = [
  { label: 'Phys sweep', sp: () => ({ ...EMPTY_SP, hp: 2, atk: 32, spe: 32 }) },
  { label: 'Spec sweep', sp: () => ({ ...EMPTY_SP, hp: 2, spa: 32, spe: 32 }) },
  { label: 'Bulk', sp: () => ({ ...EMPTY_SP, hp: 32, def: 17, spd: 17 }) },
  { label: 'Clear', sp: () => ({ ...EMPTY_SP }) },
];

export function SPAllocator({
  baseStats,
  sp,
  alignment,
  onChange,
}: {
  baseStats: StatsTable;
  sp: SPSpread;
  alignment: AlignmentName;
  onChange: (sp: SPSpread) => void;
}) {
  const total = STAT_IDS.reduce((sum, s) => sum + sp[s], 0);
  const remaining = SP_POOL - total;
  const finals = computeStats(baseStats, sp, alignment);
  const a = ALIGNMENTS[alignment];

  const bump = (stat: StatID, delta: 1 | -1) => {
    const next = sp[stat] + delta;
    if (next < 0 || next > SP_STAT_MAX) return;
    if (delta > 0 && remaining <= 0) return;
    onChange({ ...sp, [stat]: next });
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label-caps">Stat points</span>
        <span
          className={`stat-num text-sm ${
            remaining === 0 ? 'text-gold-300' : remaining < 0 ? 'text-illegal' : 'text-ink-300'
          }`}
        >
          {total}/{SP_POOL}
        </span>
      </div>
      <div className="mb-3 h-1.5 bg-ink-800">
        <div
          className="h-full bg-gold-500 transition-[width]"
          style={{ width: `${Math.min(100, (total / SP_POOL) * 100)}%` }}
        />
      </div>

      <div className="flex flex-col gap-1">
        {STAT_IDS.map((stat) => (
          <StatRow
            key={stat}
            stat={stat}
            sp={sp[stat]}
            final={finals[stat]}
            tint={a.plus === stat ? 'plus' : a.minus === stat ? 'minus' : undefined}
            canUp={sp[stat] < SP_STAT_MAX && remaining > 0}
            onBump={(d) => bump(stat, d)}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onChange(p.sp(baseStats))}
            className="chamfer-sm border border-ink-700 px-2 py-1 font-display text-xs font-semibold tracking-[0.1em] uppercase text-ink-300 hover:border-gold-600 hover:text-gold-300"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatRow({
  stat,
  sp,
  final,
  tint,
  canUp,
  onBump,
}: {
  stat: StatID;
  sp: number;
  final: number;
  tint?: 'plus' | 'minus';
  canUp: boolean;
  onBump: (delta: 1 | -1) => void;
}) {
  const { start, stop } = useRepeat(onBump);
  const hold = (delta: 1 | -1) => ({
    onPointerDown: () => start(delta),
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div className="flex items-center gap-2">
      <span
        className={`label-caps w-9 shrink-0 ${
          tint === 'plus' ? 'text-gold-400' : tint === 'minus' ? 'text-info' : ''
        }`}
      >
        {STAT_LABELS[stat]}
        {tint === 'plus' ? '+' : tint === 'minus' ? '−' : ''}
      </span>
      <button
        {...hold(-1)}
        disabled={sp === 0}
        className="h-9 w-9 shrink-0 touch-none border border-ink-700 font-mono text-lg text-ink-300 select-none disabled:opacity-30"
        aria-label={`Decrease ${stat}`}
      >
        −
      </button>
      <span className={`stat-num w-6 text-center text-sm ${sp ? 'text-gold-300' : 'text-ink-500'}`}>
        {sp}
      </span>
      <button
        {...hold(1)}
        disabled={!canUp}
        className="h-9 w-9 shrink-0 touch-none border border-ink-700 font-mono text-lg text-ink-300 select-none disabled:opacity-30"
        aria-label={`Increase ${stat}`}
      >
        +
      </button>
      <div className="h-1.5 min-w-4 flex-1 bg-ink-800">
        <div className="h-full bg-gold-500" style={{ width: `${(sp / SP_STAT_MAX) * 100}%` }} />
      </div>
      <span className="stat-num w-9 shrink-0 text-right text-sm">{final}</span>
    </div>
  );
}
