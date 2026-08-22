import { useMemo, useState } from 'react';
import { useUI } from '../../app/store';
import { AlignmentPicker } from '../../app/ui/AlignmentPicker';
import { Icon } from '../../app/ui/Icon';
import { SearchSelect } from '../../app/ui/SearchSelect';
import { Sprite } from '../../app/ui/Sprite';
import { TypeBadge } from '../../app/ui/TypeBadge';
import type { DexItem, DexLookup, DexMove, DexSpecies } from '../../data/dex';
import { useUsage } from '../../data/useUsage';
import { setViolations } from '../../engine/legality';
import {
  type AlignmentName,
  type ChampionsSet,
  type SPSpread,
  STAT_IDS,
  STAT_LABELS,
  type Team,
} from '../../engine/types';
import { updateSet } from '../../storage/teams';
import { SPAllocator } from './SPAllocator';

export function SetEditor({
  team,
  slot,
  lookup,
}: {
  team: Team;
  slot: number;
  lookup: DexLookup;
}) {
  const { openSlot } = useUI();
  const set = team.sets[slot];
  const patch = (p: Partial<ChampionsSet> | null) => updateSet(team.id, slot, p);

  // All hooks must run on every render path (empty slot vs. filled slot).
  const species = set ? lookup.getSpecies(set.species) : undefined;
  const usage = useUsage();
  // Megas are tracked separately on the ladder — prefer the forme's entry.
  const usageMon = set
    ? (usage?.get(set.megaStone ?? set.species) ?? usage?.get(set.species))
    : undefined;
  const moveUsage = useMemo(() => {
    const map = new Map<string, number>();
    for (const [name, share] of usageMon?.moves ?? []) {
      const m = lookup.getMove(name);
      if (m) map.set(m.id, share);
    }
    return map;
  }, [usageMon, lookup]);
  const itemUsage = useMemo(() => {
    const map = new Map<string, number>();
    for (const [name, share] of usageMon?.items ?? []) {
      const i = lookup.getItem(name);
      if (i) map.set(i.id, share);
    }
    return map;
  }, [usageMon, lookup]);
  const itemOptions = useMemo(
    () =>
      [...lookup.items].sort(
        (a, b) =>
          (itemUsage.get(b.id) ?? -1) - (itemUsage.get(a.id) ?? -1) ||
          a.name.localeCompare(b.name),
      ),
    [lookup, itemUsage],
  );
  const moveOptions = useMemo(
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

  const back = (
    <button onClick={() => openSlot(null)} className="label-caps self-start py-1 text-gold-400">
      ‹ {team.name}
    </button>
  );

  if (!set) {
    return (
      <div className="flex flex-col gap-3">
        {back}
        <SpeciesPicker
          lookup={lookup}
          onPick={(s) => patch({ species: s.name, ability: s.abilities[0] })}
        />
      </div>
    );
  }

  if (!species) return <div className="text-illegal">Unknown species: {set.species}</div>;

  const megas = lookup.megaFormesOf(species.name);
  const active = (set.megaStone && lookup.getSpecies(set.megaStone)) || species;
  const violations = setViolations(set, lookup.legalityContext());

  const usedItems = new Set(
    team.sets.filter((_, i) => i !== slot).flatMap((s) => (s.item ? [s.item] : [])),
  );

  return (
    <div className="flex flex-col gap-4">
      {back}

      {/* Header */}
      <div className="flex items-start gap-3">
        <Sprite spriteId={active.spriteId} size={64} />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="font-display text-2xl font-bold tracking-wide uppercase italic">
              {active.name}
            </span>
            <button
              onClick={() => {
                if (confirm(`Remove ${species.name} from the team?`)) void patch(null).then(() => openSlot(null));
              }}
              className="label-caps text-ink-500 hover:text-illegal"
            >
              Remove
            </button>
          </div>
          <div className="mt-1 flex gap-1.5">
            {active.types.map((t) => (
              <TypeBadge key={t} type={t} size="sm" />
            ))}
          </div>
        </div>
      </div>

      {violations.length > 0 && (
        <div className="flex flex-col gap-1">
          {violations.map((v, i) => (
            <p key={i} className="flex items-center gap-2 text-sm text-illegal">
              <Icon name="alert" size={14} /> {v.message}
            </p>
          ))}
        </div>
      )}

      {/* Mega forme */}
      {megas.length > 0 && (
        <Labeled label="Forme">
          <div className="flex gap-1.5">
            <FormeButton active={!set.megaStone} onClick={() => patch({ megaStone: undefined })}>
              Base
            </FormeButton>
            {megas.map((m) => (
              <FormeButton
                key={m.id}
                active={set.megaStone === m.name}
                // Megas must hold their stone (ladder-verified) — set it too.
                onClick={() =>
                  patch({ megaStone: m.name, item: lookup.stoneFor(m.name)?.name ?? set.item })
                }
              >
                {m.name.replace(`${species.name}-`, '')}
              </FormeButton>
            ))}
          </div>
        </Labeled>
      )}

      {/* Ability — mega formes have a fixed ability */}
      <Labeled label="Ability">
        {set.megaStone ? (
          <p className="px-0.5 text-sm text-ink-300">
            {active.abilities[0]}
            <span className="ml-2 text-xs text-ink-500">(fixed on mega)</span>
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {species.abilities.map((ab) => (
              <FormeButton key={ab} active={set.ability === ab} onClick={() => patch({ ability: ab })}>
                {ab}
              </FormeButton>
            ))}
          </div>
        )}
      </Labeled>

      {/* Item — a mega's slot is its stone, not a choice */}
      <Labeled label="Item">
        {set.megaStone ? (
          <p className="px-0.5 text-sm text-ink-300">
            {lookup.stoneFor(set.megaStone)?.name ?? set.item ?? '—'}
            <span className="ml-2 text-xs text-ink-500">(required to mega evolve)</span>
          </p>
        ) : (
        <SearchSelect<DexItem>
          value={set.item ? lookup.getItem(set.item) : undefined}
          placeholder="No item"
          options={itemOptions}
          keyOf={(i) => i.id}
          filter={(i, q) => i.name.toLowerCase().includes(q)}
          disabledKeys={new Set(lookup.items.filter((i) => usedItems.has(i.name)).map((i) => i.id))}
          renderValue={(i) => (
            <span>
              {i.name}
              {itemUsage.has(i.id) && (
                <span className="stat-num ml-2 text-[0.7rem] text-gold-400">
                  {(itemUsage.get(i.id)! * 100).toFixed(0)}%
                </span>
              )}
              {usedItems.has(i.name) && (
                <span className="ml-2 text-xs text-illegal">item clause</span>
              )}
            </span>
          )}
          renderOption={(i) => (
            <span className="flex items-baseline gap-2">
              <span className="flex-1">{i.name}</span>
              {itemUsage.has(i.id) && (
                <span className="stat-num shrink-0 text-[0.7rem] text-gold-400">
                  {(itemUsage.get(i.id)! * 100).toFixed(0)}%
                </span>
              )}
              {usedItems.has(i.name) && (
                <span className="shrink-0 text-xs text-illegal">on team</span>
              )}
            </span>
          )}
          onSelect={(i) => patch({ item: i.name })}
          onClear={() => patch({ item: undefined })}
        />
        )}
      </Labeled>

      {/* Alignment */}
      <Labeled label="Stat alignment">
        <AlignmentPicker value={set.alignment} onChange={(alignment) => patch({ alignment })} />
      </Labeled>

      {/* Moves */}
      <Labeled label="Moves">
        <div className="flex flex-col gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <SearchSelect<DexMove>
              key={`${i}-${set.moves[i] ?? 'empty'}`}
              value={set.moves[i] ? lookup.getMove(set.moves[i]!) : undefined}
              placeholder={`Move ${i + 1}`}
              options={moveOptions}
              keyOf={(m) => m.id}
              filter={(m, q) => m.name.toLowerCase().includes(q)}
              renderValue={(m) => <MoveRow move={m} pct={moveUsage.get(m.id)} />}
              renderOption={(m) => <MoveRow move={m} pct={moveUsage.get(m.id)} />}
              onSelect={(m) => {
                const moves = [...set.moves] as ChampionsSet['moves'];
                moves[i] = m.name;
                patch({ moves });
              }}
              onClear={() => {
                const moves = [...set.moves] as ChampionsSet['moves'];
                moves[i] = undefined;
                patch({ moves });
              }}
            />
          ))}
        </div>
      </Labeled>

      {/* SP — final stats always follow the active (mega) forme */}
      <MetaSpreadSuggestions
        speciesName={active.name}
        baseName={species.name}
        onApply={(alignment, sp) => patch({ alignment, sp })}
      />
      <SPAllocator
        baseStats={active.baseStats}
        sp={set.sp}
        alignment={set.alignment}
        onChange={(sp) => patch({ sp })}
      />
    </div>
  );
}

/** "Suggest spread from usage" (plan §4 SPAllocator) — top meta spreads, one tap. */
function MetaSpreadSuggestions({
  speciesName,
  baseName,
  onApply,
}: {
  speciesName: string; // active forme (usage tracks megas separately)
  baseName: string;
  onApply: (alignment: AlignmentName, sp: SPSpread) => void;
}) {
  const usage = useUsage();
  const mon = usage?.get(speciesName) ?? usage?.get(baseName);
  if (!mon || mon.spreads.length === 0) return null;

  return (
    <div>
      <p className="label-caps mb-1.5">
        Meta spreads{usage?.data.synthetic ? ' (sample data)' : ''}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {mon.spreads.slice(0, 3).map((s, i) => (
          <button
            key={i}
            onClick={() => onApply(s.alignment as AlignmentName, { ...s.sp })}
            className="chamfer-sm border border-ink-700 px-2 py-1 text-left font-display text-xs font-semibold tracking-[0.06em] uppercase text-ink-300 hover:border-gold-600 hover:text-gold-300"
          >
            {s.alignment}{' '}
            <span className="stat-num normal-case">
              {STAT_IDS.filter((id) => s.sp[id] > 0)
                .map((id) => `${s.sp[id]} ${STAT_LABELS[id]}`)
                .join(' / ')}
            </span>{' '}
            <span className="text-ink-500">{(s.pct * 100).toFixed(0)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label-caps mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function FormeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`chamfer-sm px-2.5 py-1 font-display text-sm font-semibold tracking-[0.08em] uppercase ${
        active ? 'bg-gold-500 text-ink-950' : 'border border-ink-700 text-ink-300'
      }`}
    >
      {children}
    </button>
  );
}

function MoveRow({ move, pct }: { move: DexMove; pct?: number }) {
  return (
    <span className="flex items-center gap-2">
      <TypeBadge type={move.type} size="sm" />
      <span className="flex-1">{move.name}</span>
      {pct !== undefined && (
        <span className="stat-num text-[0.7rem] text-gold-400">
          {(pct * 100).toFixed(0)}%
        </span>
      )}
      <span className="label-caps">{move.category.slice(0, 4)}</span>
      <span className="stat-num w-7 text-right text-xs text-ink-300">{move.basePower || '—'}</span>
    </span>
  );
}

/** Roster search for an empty slot, usage-ranked (plan §4 SpeciesPicker). */
export function SpeciesPicker({
  lookup,
  onPick,
}: {
  lookup: DexLookup;
  onPick: (s: DexSpecies) => void;
}) {
  const [query, setQuery] = useState('');
  const usage = useUsage();

  // A base species inherits its best usage entry (its own or any mega forme's).
  const usageOf = useMemo(() => {
    const map = new Map<string, { rank: number; pct: number }>();
    if (!usage) return map;
    for (const s of lookup.roster) {
      const entries = [s.name, ...lookup.megaFormesOf(s.name).map((m) => m.name)]
        .map((n) => usage.get(n))
        .filter((m): m is NonNullable<typeof m> => !!m);
      if (entries.length) {
        const best = entries.reduce((a, b) => (a.rank < b.rank ? a : b));
        map.set(s.name, { rank: best.rank, pct: best.usage });
      }
    }
    return map;
  }, [usage, lookup]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lookup.roster
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          (usageOf.get(a.name)?.rank ?? Infinity) - (usageOf.get(b.name)?.rank ?? Infinity) ||
          a.name.localeCompare(b.name),
      );
  }, [lookup, query, usageOf]);

  return (
    <div className="flex flex-col gap-2">
      <p className="label-caps">Choose a species</p>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search…"
        className="min-h-11 border border-ink-700 bg-ink-850 px-3 text-sm outline-none placeholder:text-ink-500 focus:border-gold-600"
      />
      <ul className="chamfer border border-ink-800 bg-ink-900">
        {rows.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => onPick(s)}
              className="flex w-full items-center gap-3 border-b border-ink-800/60 px-3 py-2 text-left hover:bg-ink-850"
            >
              <Sprite spriteId={s.spriteId} size={36} />
              <span className="flex-1 font-display text-base font-semibold tracking-wide uppercase">
                {s.name}
              </span>
              {usageOf.has(s.name) && (
                <span className="stat-num text-xs text-gold-400">
                  {(usageOf.get(s.name)!.pct * 100).toFixed(1)}%
                </span>
              )}
              <span className="flex gap-1">
                {s.types.map((t) => (
                  <TypeBadge key={t} type={t} size="sm" />
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
