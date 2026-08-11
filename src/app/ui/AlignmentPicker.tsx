import { useState } from 'react';
import { ALIGNMENTS, type AlignmentName, type StatID } from '../../engine/types';

const PLUS_MINUS: Exclude<StatID, 'hp'>[] = ['atk', 'def', 'spa', 'spd', 'spe'];

/** Pick +10% / −10% stats directly; the alignment (nature) name is derived. */
export function AlignmentPicker({
  value,
  onChange,
}: {
  value: AlignmentName;
  onChange: (a: AlignmentName) => void;
}) {
  const current = ALIGNMENTS[value];
  const [plus, setPlus] = useState<Exclude<StatID, 'hp'> | null>(current.plus);
  const [minus, setMinus] = useState<Exclude<StatID, 'hp'> | null>(current.minus);

  const apply = (p: typeof plus, m: typeof minus) => {
    setPlus(p);
    setMinus(m);
    const match = Object.values(ALIGNMENTS).find((a) =>
      p && m && p !== m ? a.plus === p && a.minus === m : a.plus === null && a.minus === null,
    );
    if (match) onChange(match.name);
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
