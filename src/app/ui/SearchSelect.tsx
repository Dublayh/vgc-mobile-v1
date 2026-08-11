import { useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * Inline expanding search-picker (mobile-first: no portals/popovers).
 * Closed: a field-styled button showing the current value. Open: a search
 * input over a scrollable option list.
 */
export function SearchSelect<T>({
  value,
  placeholder,
  options,
  filter,
  renderValue,
  renderOption,
  onSelect,
  onClear,
  disabledKeys,
  keyOf,
}: {
  value: T | undefined;
  placeholder: string;
  options: T[];
  filter: (option: T, query: string) => boolean;
  renderValue: (value: T) => ReactNode;
  renderOption: (option: T) => ReactNode;
  onSelect: (option: T) => void;
  onClear?: () => void;
  /** greyed out but still selectable (e.g. item-clause conflicts) */
  disabledKeys?: Set<string>;
  keyOf: (option: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? options.filter((o) => filter(o, q)) : options).slice(0, 60);
  }, [options, query, filter]);

  if (!open) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            setOpen(true);
            setQuery('');
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className={`min-h-10 flex-1 border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-left text-sm ${
            value ? 'text-ink-50' : 'text-ink-500'
          }`}
        >
          {value ? renderValue(value) : placeholder}
        </button>
        {value && onClear && (
          <button
            onClick={onClear}
            className="px-2 py-1.5 text-ink-500 hover:text-illegal"
            aria-label="Clear"
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="border border-gold-600/60 bg-ink-850">
      <div className="flex items-center border-b border-ink-700">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="min-h-10 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-ink-500"
        />
        <button onClick={() => setOpen(false)} className="label-caps px-3 py-2">
          Done
        </button>
      </div>
      <ul className="max-h-56 overflow-y-auto">
        {matches.map((o) => {
          const key = keyOf(o);
          const disabled = disabledKeys?.has(key);
          return (
            <li key={key}>
              <button
                onClick={() => {
                  onSelect(o);
                  setOpen(false);
                }}
                className={`w-full border-b border-ink-800/60 px-2.5 py-2 text-left text-sm hover:bg-ink-800 ${
                  disabled ? 'opacity-40' : ''
                }`}
              >
                {renderOption(o)}
              </button>
            </li>
          );
        })}
        {matches.length === 0 && (
          <li className="px-2.5 py-3 text-sm text-ink-500">No matches</li>
        )}
      </ul>
    </div>
  );
}
