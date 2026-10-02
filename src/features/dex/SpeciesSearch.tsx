/**
 * Search-and-pick list over any species set (roster, every forme, meta mons),
 * usage-ranked when ladder data exists. A base species inherits its best
 * usage entry (its own or a mega forme's) so Garchomp ranks by Garchomp-Mega.
 */
import { useMemo, useState } from 'react';
import { pct } from '../../app/ui/format';
import { Sprite } from '../../app/ui/Sprite';
import { TypeBadge } from '../../app/ui/TypeBadge';
import type { DexLookup, DexSpecies } from '../../data/dex';
import type { UsageLookup } from '../../data/usage';

export function SpeciesSearch({
  species,
  lookup,
  usage,
  onPick,
  placeholder = 'Search…',
  limit = 50,
  autoFocus,
  showRank,
  showTypes = true,
  listClass = 'max-h-64 overflow-y-auto',
  spriteSize = 32,
}: {
  species: DexSpecies[];
  lookup: DexLookup;
  usage?: UsageLookup | null;
  onPick: (s: DexSpecies) => void;
  placeholder?: string;
  limit?: number;
  autoFocus?: boolean;
  showRank?: boolean;
  showTypes?: boolean;
  listClass?: string;
  spriteSize?: number;
}) {
  const [query, setQuery] = useState('');

  const usageOf = useMemo(() => {
    const map = new Map<string, { rank: number; usage: number }>();
    if (!usage) return map;
    for (const s of species) {
      const entries = [s.name, ...lookup.megaFormesOf(s.name).map((m) => m.name)]
        .map((n) => usage.get(n))
        .filter((m): m is NonNullable<typeof m> => !!m);
      if (entries.length) {
        const best = entries.reduce((a, b) => (a.rank < b.rank ? a : b));
        map.set(s.name, { rank: best.rank, usage: best.usage });
      }
    }
    return map;
  }, [species, usage, lookup]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return species
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          (usageOf.get(a.name)?.rank ?? Infinity) - (usageOf.get(b.name)?.rank ?? Infinity) ||
          a.name.localeCompare(b.name),
      )
      .slice(0, limit);
  }, [species, query, usageOf, limit]);

  return (
    <div className="flex flex-col gap-1">
      <input
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="min-h-10 w-full border border-ink-700 bg-ink-850 px-2.5 text-sm outline-none placeholder:text-ink-500 focus:border-gold-600"
      />
      <ul className={listClass}>
        {rows.map((s) => {
          const u = usageOf.get(s.name);
          return (
            <li key={s.id}>
              <button
                onClick={() => {
                  onPick(s);
                  setQuery('');
                }}
                className="flex w-full items-center gap-2.5 border-b border-ink-800/60 px-1 py-1.5 text-left hover:bg-ink-850"
              >
                {showRank && (
                  <span className="stat-num w-6 text-right text-xs text-ink-500">{u?.rank ?? '·'}</span>
                )}
                <Sprite spriteId={s.spriteId} size={spriteSize} />
                <span className="flex-1 font-display text-sm font-semibold tracking-wide uppercase">
                  {s.name}
                </span>
                {u && <span className="stat-num text-xs text-ink-500">{pct(u.usage)}</span>}
                {showTypes && (
                  <span className="flex gap-1">
                    {s.types.map((t) => (
                      <TypeBadge key={t} type={t} size="sm" />
                    ))}
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {rows.length === 0 && <li className="px-2 py-3 text-sm text-ink-500">No matches</li>}
      </ul>
    </div>
  );
}
