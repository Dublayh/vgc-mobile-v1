import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Size = 'xs' | 'sm' | 'md';

const SIZES: Record<Size, string> = {
  xs: 'px-1.5 py-0.5 text-[0.7rem] tracking-[0.06em]',
  sm: 'px-2 py-1 text-xs tracking-[0.1em]',
  md: 'px-3 py-1 text-sm tracking-[0.1em]',
};

/**
 * Toggle chip — the design system's single on/off control: gold fill when
 * active, carbon outline otherwise. Used for field toggles, formes, sub-tab
 * segments and spread presets.
 */
export function Chip({
  active,
  size = 'sm',
  className = '',
  ...rest
}: { active: boolean; size?: Size } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`chamfer-sm font-display font-semibold uppercase ${SIZES[size]} ${
        active
          ? 'bg-gold-500 text-ink-950'
          : 'border border-ink-700 text-ink-400 hover:border-gold-600 hover:text-gold-300'
      } ${className}`}
      {...rest}
    />
  );
}

export interface SegmentOption<T> {
  value: T;
  label: ReactNode;
}

/** Single-select row of chips (sub-tabs, modes, enum fields). */
export function Segmented<T>({
  value,
  options,
  onChange,
  size = 'sm',
  className = '',
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
  size?: Size;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {options.map((o, i) => (
        <Chip key={i} size={size} active={Object.is(o.value, value)} onClick={() => onChange(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}
