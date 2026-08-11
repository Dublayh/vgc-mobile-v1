import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const STYLES: Record<Variant, string> = {
  primary:
    'chamfer-sm bg-gold-500 text-ink-950 hover:bg-gold-400 active:bg-gold-600',
  secondary:
    'chamfer-sm border border-ink-700 bg-ink-850 text-ink-50 hover:border-gold-600 hover:text-gold-300',
  ghost: 'text-ink-300 hover:text-gold-300',
  danger:
    'chamfer-sm border border-illegal/40 bg-illegal/10 text-illegal hover:bg-illegal/20',
};

export function Button({
  variant = 'secondary',
  className = '',
  ...rest
}: { variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 font-display text-[0.95rem] font-semibold tracking-[0.08em] uppercase transition-colors disabled:pointer-events-none disabled:opacity-40 ${STYLES[variant]} ${className}`}
      {...rest}
    />
  );
}
