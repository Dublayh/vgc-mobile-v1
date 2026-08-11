import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Core surface: carbon card with the signature chamfered corner and a
 * gold tick before the title. Nest content freely.
 */
export function Panel({
  title,
  aside,
  children,
  className = '',
  ...rest
}: {
  title?: string;
  aside?: ReactNode; // right side of the header row (badges, actions)
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={`chamfer border border-ink-800 bg-ink-900 ${className}`}
      {...rest}
    >
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-ink-800 px-3.5 py-2.5">
          <h2 className="label-caps flex items-center gap-2 text-ink-200">
            <span className="h-3 w-[3px] bg-gold-500" aria-hidden />
            {title}
          </h2>
          {aside}
        </header>
      )}
      <div className="p-3.5">{children}</div>
    </section>
  );
}
