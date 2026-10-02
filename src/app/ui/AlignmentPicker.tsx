import { useState } from 'react';
import { ALIGNMENTS, type AlignmentName, type StatID } from '../../engine/types';

const PLUS_MINUS: Exclude<StatID, 'hp'>[] = ['atk', 'def', 'spa', 'spd', 'spe'];
type Stat = Exclude<StatID, 'hp'> | null;

/**
 * Pick +10% / −10% stats directly; the alignment (nature) name is derived.
 * The highlighted stats are DERIVED from `value` so external changes (meta
 * spread chips, imports, calc seeding) are reflected immediately. The one
 * exception is a half-picked state (only + or only − chosen so far), which
 * has no alignment of its own: it is remembered locally until the picker's
 * own emitted value is replaced from outside.
 */
export function AlignmentPicker({
  value,
  onChange,
}: {
  value: AlignmentName;
  onChange: (a: AlignmentName) => void;
}) {
  const current = ALIGNMENTS[value];
  const [pending, setPending] = useState<{ emitted: AlignmentName; plus: Stat; minus: Stat } | null>(
    null,
  );
  const live = pending && pending.emitted === value ? pending : current;
  const plus = live.plus;
  const minus = live.minus;

  const apply = (p: Stat, m: Stat) => {
    const complete = p && m && p !== m;
    const match = Object.values(ALIGNMENTS).find((a) =>
      complete ? a.plus === p && a.minus === m : a.plus === null && a.minus === null,
    );
    if (!match) return;
    setPending(complete ? null : { emitted: match.name, plus: p, minus: m });
    onChange(match.name);
  };

  const row = (kind: 'plus' | 'minus') => (
    <div className="flex items-center gap-1.5">
      <span className={`label-caps w-10 ${kind === 'plus' ? 'text-gold-400' : 'text-info'}`}>
        {kind === 'plus' ? '+10%' : '−10%'}
      </span>
      {PLUS_MINUS.map((s) => {
        const selected = (kind === 'plus' ? plus : minus) === s;
        return (
          <button
            key={s}
            onClick={() =>
              kind === 'plus'
                ? apply(selected ? null : s, minus)
                : apply(plus, selected ? null : s)
            }
            className={`chamfer-sm flex-1 py-1 font-display text-xs font-semibold tracking-[0.08em] uppercase ${
              selected
                ? kind === 'plus'
                  ? 'bg-gold-500 text-ink-950'
                  : 'bg-info text-ink-950'
                : 'border border-ink-700 text-ink-400'
            }`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-1.5">
      {row('plus')}
      {row('minus')}
      <p className="text-xs text-ink-500">
        {value} {current.plus === null && '(neutral)'}
      </p>
    </div>
  );
}
