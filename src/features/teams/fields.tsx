/**
 * Set-editing fields shared by the SetEditor (saved teams) and the calc's
 * scratch editor (working copies): usage-sorted item/move options, meta
 * spread chips, item + ability pickers.
 */
import { useMemo, type ReactNode } from 'react';
import { Chip } from '../../app/ui/Chip';
import { pct, spreadLabel } from '../../app/ui/format';
import { SearchSelect } from '../../app/ui/SearchSelect';
import { TypeBadge } from '../../app/ui/TypeBadge';
import type { DexItem, DexLookup, DexMove, DexSpecies } from '../../data/dex';
import { useUsage } from '../../data/useUsage';
import type { AlignmentName, ChampionsSet, SPSpread } from '../../engine/types';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="label-caps mb-1.5">{label}</p>
      {children}
    </div>
  );
}

/** Ladder usage for a set's active forme (megas are tracked separately). */
export function useSetUsage(set: ChampionsSet | undefined, lookup: DexLookup) {
  const usage = useUsage();
  const mon = set
    ? (usage?.get(set.megaStone ?? set.species) ?? usage?.get(set.species))
    : undefined;
  const moveUsage = useMemo(() => {
    const map = new Map<string, number>();
    for (const [name, share] of mon?.moves ?? []) {
      const m = lookup.getMove(name);
      if (m) map.set(m.id, share);
    }
    return map;
  }, [mon, lookup]);
  const itemUsage = useMemo(() => {
    const map = new Map<string, number>();
    for (const [name, share] of mon?.items ?? []) {
      const i = lookup.getItem(name);
      if (i) map.set(i.id, share);
    }
    return map;
  }, [mon, lookup]);
  const itemOptions = useMemo(
    () =>
      [...lookup.items].sort(
        (a, b) =>
          (itemUsage.get(b.id) ?? -1) - (itemUsage.get(a.id) ?? -1) || a.name.localeCompare(b.name),
      ),
    [lookup, itemUsage],
  );
  return { usage, mon, moveUsage, itemUsage, itemOptions };
}

/** A species' learnset as move options, most-used first. */
export function useMoveOptions(
  species: DexSpecies | undefined,
  moveUsage: Map<string, number>,
  lookup: DexLookup,
): DexMove[] {
  return useMemo(
    () =>
      species
        ? species.learnset
            .map((id) => lookup.getMove(id))
            .filter((m): m is DexMove => !!m)
            .sort(
              (a, b) =>
                (moveUsage.get(b.id) ?? -1) - (moveUsage.get(a.id) ?? -1) ||
                a.name.localeCompare(b.name),
            )
        : [],
    [species, lookup, moveUsage],
  );
}

export interface SpreadOption {
  alignment: string;
  sp: SPSpread;
  pct?: number;
  /** replaces the generated "Alignment 32/32/2" text */
  label?: string;
}

/** One-tap spread presets (meta spreads, sweep "as" spreads). */
export function SpreadChips({
  spreads,
  current,
  onPick,
  named,
  size = 'sm',
}: {
  spreads: SpreadOption[];
  /** highlighted when it matches an option exactly */
  current?: { alignment: AlignmentName; sp: SPSpread };
  onPick: (alignment: AlignmentName, sp: SPSpread) => void;
  /** "32 HP / 32 Atk" instead of "32/32" */
  named?: boolean;
  size?: 'xs' | 'sm';
}) {
  if (spreads.length === 0) return null;
  const isCurrent = (s: SpreadOption) =>
    !!current &&
    s.alignment === current.alignment &&
    (Object.keys(s.sp) as (keyof SPSpread)[]).every((id) => s.sp[id] === current.sp[id]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {spreads.map((s, i) => (
        <Chip
          key={i}
          size={size}
          active={isCurrent(s)}
          onClick={() => onPick(s.alignment as AlignmentName, { ...s.sp })}
          className="text-left"
        >
          {s.label ?? (
            <>
              {s.alignment}{' '}
              <span className="stat-num normal-case">
                {spreadLabel(s.sp, named ? 'named' : 'short')}
              </span>
            </>
          )}
          {s.pct !== undefined && <span className="ml-1 opacity-60">{pct(s.pct, 0)}</span>}
        </Chip>
      ))}
    </div>
  );
}

export function MoveRow({ move, pct: share }: { move: DexMove; pct?: number }) {
  return (
    <span className="flex items-center gap-2">
      <TypeBadge type={move.type} size="sm" />
      <span className="flex-1">{move.name}</span>
      {share !== undefined && (
        <span className="stat-num text-[0.7rem] text-gold-400">{pct(share, 0)}</span>
      )}
      <span className="label-caps">{move.category.slice(0, 4)}</span>
      <span className="stat-num w-7 text-right text-xs text-ink-300">{move.basePower || '—'}</span>
    </span>
  );
}

export function ItemRow({ item, pct: share, onTeam }: { item: DexItem; pct?: number; onTeam?: boolean }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="flex-1">{item.name}</span>
      {share !== undefined && (
        <span className="stat-num shrink-0 text-[0.7rem] text-gold-400">{pct(share, 0)}</span>
      )}
      {onTeam && <span className="shrink-0 text-xs text-illegal">item clause</span>}
    </span>
  );
}

/** Item picker; a mega's slot is its stone, not a choice. */
export function ItemField({
  set,
  lookup,
  itemOptions,
  itemUsage,
  usedItems,
  onChange,
}: {
  set: ChampionsSet;
  lookup: DexLookup;
  itemOptions: DexItem[];
  itemUsage: Map<string, number>;
  /** items held elsewhere on the team (item clause) — greyed, still pickable */
  usedItems?: Set<string>;
  onChange: (item: string | undefined) => void;
}) {
  if (set.megaStone) {
    return (
      <p className="px-0.5 text-sm text-ink-300">
        {lookup.stoneFor(set.megaStone)?.name ?? set.item ?? '—'}
        <span className="ml-2 text-xs text-ink-500">(required to mega evolve)</span>
      </p>
    );
  }
  const row = (i: DexItem) => <ItemRow item={i} pct={itemUsage.get(i.id)} onTeam={usedItems?.has(i.name)} />;
  return (
    <SearchSelect<DexItem>
      value={set.item ? lookup.getItem(set.item) : undefined}
      placeholder="No item"
      options={itemOptions}
      keyOf={(i) => i.id}
      filter={(i, q) => i.name.toLowerCase().includes(q)}
      disabledKeys={
        usedItems && new Set(itemOptions.filter((i) => usedItems.has(i.name)).map((i) => i.id))
      }
      renderValue={row}
      renderOption={row}
      onSelect={(i) => onChange(i.name)}
      onClear={() => onChange(undefined)}
    />
  );
}

/** Ability chips; mega formes have exactly one, fixed. */
export function AbilityField({
  set,
  base,
  forme,
  onChange,
}: {
  set: ChampionsSet;
  /** roster-legal base species (its abilities are the choices) */
  base: DexSpecies;
  /** active forme (a mega's single ability is shown when set) */
  forme: DexSpecies;
  onChange: (ability: string) => void;
}) {
  if (set.megaStone) {
    return (
      <p className="px-0.5 text-sm text-ink-300">
        {forme.abilities[0]}
        <span className="ml-2 text-xs text-ink-500">(fixed on mega)</span>
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {base.abilities.map((ab) => (
        <Chip key={ab} size="md" active={set.ability === ab} onClick={() => onChange(ab)}>
          {ab}
        </Chip>
      ))}
    </div>
  );
}
