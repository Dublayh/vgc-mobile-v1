import { SP_STAT_MAX } from '../../engine/types';

/**
 * One row of the stat readout: label · SP invested · bar · final stat.
 * The gold segment is the SP contribution — investment stays visible on
 * top of the base (bone) segment. Alignment +/− tints the label.
 */
export function StatBar({
  label,
  value,
  sp,
  max = 240,
  alignment,
}: {
  label: string;
  value: number;
  /** omit to hide the SP column entirely (e.g. dex base-stat views) */
  sp?: number;
  max?: number; // scale ceiling; ~240 covers L50 non-HP stats
  alignment?: 'plus' | 'minus';
}) {
  const invested = sp ?? 0;
  const basePct = Math.min(100, ((value - invested) / max) * 100);
  const spPct = Math.min(100 - basePct, (invested / max) * 100);
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`label-caps w-9 shrink-0 ${
          alignment === 'plus'
            ? 'text-gold-400'
            : alignment === 'minus'
              ? 'text-info'
              : ''
        }`}
      >
        {label}
        {alignment === 'plus' ? '+' : alignment === 'minus' ? '−' : ''}
      </span>
      {sp !== undefined && (
        <span
          className={`stat-num w-7 shrink-0 text-right text-xs ${
            sp > 0 ? (sp >= SP_STAT_MAX ? 'text-gold-300' : 'text-gold-400') : 'text-ink-500'
          }`}
        >
          {sp > 0 ? sp : '·'}
        </span>
      )}
      <div className="h-2 flex-1 bg-ink-800">
        <div className="flex h-full">
          <div className="h-full bg-ink-300" style={{ width: `${basePct}%` }} />
          <div className="h-full bg-gold-500" style={{ width: `${spPct}%` }} />
        </div>
      </div>
      <span className="stat-num w-9 shrink-0 text-right text-sm text-ink-50">{value}</span>
    </div>
  );
}
