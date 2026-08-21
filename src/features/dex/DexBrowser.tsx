import { lazy, Suspense, useMemo, useState } from 'react';
import { useUI } from '../../app/store';
import { Panel } from '../../app/ui/Panel';
import { SearchSelect } from '../../app/ui/SearchSelect';
import { Sprite } from '../../app/ui/Sprite';
import { POKEMON_TYPES, TypeBadge } from '../../app/ui/TypeBadge';
import { StatBar } from '../../app/ui/StatBar';
import type { DexAbility, DexLookup, DexMove, DexSpecies } from '../../data/dex';
import { STAT_IDS, STAT_LABELS } from '../../engine/types';
import { useJumpToCalc } from '../calc/jumpToCalc';

// Carries the calc engine — keep it out of the main chunk.
const OhkoSweepPanel = lazy(() =>
  import('../analysis/OhkoSweepPanel').then((m) => ({ default: m.OhkoSweepPanel })),
);

export function DexBrowser({ lookup }: { lookup: DexLookup }) {
  const { dexSpecies, openDexSpecies } = useUI();
  const selected = dexSpecies ? lookup.getSpecies(dexSpecies) : undefined;
  if (selected) {
    return (
      <SpeciesDetail
        species={selected.baseSpecies ? lookup.getSpecies(selected.baseSpecies)! : selected}
        lookup={lookup}
        onBack={() => openDexSpecies(null)}
      />
    );
  }
  return <SpeciesList lookup={lookup} onOpen={(s) => openDexSpecies(s.id)} />;
}

function SpeciesList({
  lookup,
  onOpen,
}: {
  lookup: DexLookup;
  onOpen: (s: DexSpecies) => void;
}) {
  const [query, setQuery] = useState('');
  const [types, setTypes] = useState<string[]>([]); // AND — type combo search
  const [megaOnly, setMegaOnly] = useState(false);
  const [ability, setAbility] = useState<DexAbility | undefined>();
  const [moveFilters, setMoveFilters] = useState<DexMove[]>([]); // AND — must learn all
  const [showFilters, setShowFilters] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Ability search is mega-aware: a base row matches if it OR one of its
    // mega formes has the ability (Sand Force finds Garchomp via its mega).
    const hasAbility = (s: DexSpecies) =>
      !ability ||
      s.abilities.includes(ability.name) ||
      lookup.megaFormesOf(s.name).some((m) => m.abilities.includes(ability.name));
    return lookup.roster
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .filter((s) => types.every((t) => s.types.some((st) => st.toLowerCase() === t)))
      .filter((s) => !megaOnly || lookup.megaFormesOf(s.name).length > 0)
      .filter(hasAbility)
      .filter((s) => moveFilters.every((m) => s.learnset.includes(m.id)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [lookup, query, types, megaOnly, ability, moveFilters]);

  const activeFilterCount = (ability ? 1 : 0) + moveFilters.length + types.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${lookup.roster.length} species…`}
          className="min-h-11 flex-1 border border-ink-700 bg-ink-850 px-3 text-sm outline-none placeholder:text-ink-500 focus:border-gold-600"
        />
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`chamfer-sm shrink-0 px-3 font-display text-sm font-semibold tracking-[0.08em] uppercase ${
            showFilters || activeFilterCount
              ? 'bg-gold-500 text-ink-950'
              : 'border border-ink-700 text-ink-400'
          }`}
        >
          Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setMegaOnly((v) => !v)}
          className={`chamfer-sm shrink-0 px-2 py-0.5 font-display text-[0.8rem] font-semibold tracking-[0.12em] uppercase ${
            megaOnly ? 'bg-gold-500 text-ink-950' : 'border border-ink-700 text-ink-400'
          }`}
        >
          Mega
        </button>
        {POKEMON_TYPES.map((t) => (
          <button
            key={t}
            onClick={() =>
              setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t])
            }
            className={types.includes(t) ? '' : 'opacity-45'}
          >
            <TypeBadge type={t} size="sm" />
          </button>
        ))}
      </div>

      {showFilters && (
        <div className="chamfer flex flex-col gap-2.5 border border-ink-800 bg-ink-900 p-3">
          <div>
            <p className="label-caps mb-1.5">Ability (incl. mega formes)</p>
            <SearchSelect<DexAbility>
              value={ability}
              placeholder="Any ability"
              options={lookup.abilities}
              keyOf={(a) => a.id}
              filter={(a, q2) => a.name.toLowerCase().includes(q2)}
              renderValue={(a) => <span>{a.name}</span>}
              renderOption={(a) => (
                <span className="flex flex-col">
                  <span>{a.name}</span>
                  {a.shortDesc && <span className="text-xs text-ink-500">{a.shortDesc}</span>}
                </span>
              )}
              onSelect={setAbility}
              onClear={() => setAbility(undefined)}
            />
          </div>
          <div>
            <p className="label-caps mb-1.5">Learns all of these moves</p>
            <div className="flex flex-col gap-1.5">
              {moveFilters.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-sm">
                  <TypeBadge type={m.type} size="sm" />
                  <span className="flex-1">{m.name}</span>
                  <button
                    onClick={() => setMoveFilters(moveFilters.filter((x) => x.id !== m.id))}
                    className="px-1.5 text-ink-500 hover:text-illegal"
                    aria-label={`Remove ${m.name}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {moveFilters.length < 4 && (
                <SearchSelect<DexMove>
                  value={undefined}
                  placeholder="Add a move…"
                  options={lookup.moves.filter((m) => !moveFilters.some((x) => x.id === m.id))}
                  keyOf={(m) => m.id}
                  filter={(m, q2) => m.name.toLowerCase().includes(q2)}
                  renderValue={(m) => <span>{m.name}</span>}
                  renderOption={(m) => (
                    <span className="flex items-center gap-2">
                      <TypeBadge type={m.type} size="sm" />
                      <span className="flex-1">{m.name}</span>
                      <span className="label-caps">{m.category.slice(0, 4)}</span>
                    </span>
                  )}
                  onSelect={(m) => setMoveFilters([...moveFilters, m])}
                />
              )}
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setAbility(undefined);
                setMoveFilters([]);
                setTypes([]);
              }}
              className="label-caps self-start text-illegal"
            >
              Clear all filters
            </button>
          )}
          <p className="stat-num text-xs text-ink-500">{rows.length} match{rows.length === 1 ? '' : 'es'}</p>
        </div>
      )}

      <ul className="chamfer border border-ink-800 bg-ink-900">
        {rows.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => onOpen(s)}
              className="flex w-full items-center gap-3 border-b border-ink-800/60 px-3 py-2 text-left hover:bg-ink-850"
            >
              <Sprite spriteId={s.spriteId} size={40} />
              <span className="flex-1">
                <span className="flex items-center gap-1.5 font-display text-base font-semibold tracking-wide uppercase">
                  {s.name}
                  {lookup.megaFormesOf(s.name).length > 0 && (
                    <span className="chamfer-sm bg-gold-950 px-1 text-[0.65rem] text-gold-400">
                      MEGA
                    </span>
                  )}
                </span>
                <span className="mt-0.5 flex gap-1">
                  {s.types.map((t) => (
                    <TypeBadge key={t} type={t} size="sm" />
                  ))}
                </span>
              </span>
              <span className="text-right">
                <span className="label-caps block">BST</span>
                <span className="stat-num text-sm">
                  {Object.values(s.baseStats).reduce((a, b) => a + b, 0)}
                </span>
              </span>
              <span className="w-10 text-right">
                <span className="label-caps block">Spe</span>
                <span className="stat-num text-sm">{s.baseStats.spe}</span>
              </span>
            </button>
          </li>
        ))}
        {rows.length === 0 && <li className="px-3 py-4 text-sm text-ink-500">No matches</li>}
      </ul>
    </div>
  );
}

function SpeciesDetail({
  species,
  lookup,
  onBack,
}: {
  species: DexSpecies;
  lookup: DexLookup;
  onBack: () => void;
}) {
  const [forme, setForme] = useState<DexSpecies>(species);
  const [moveQuery, setMoveQuery] = useState('');
  const jumpToCalc = useJumpToCalc(lookup);
  const megas = lookup.megaFormesOf(species.name);
  const formes = [species, ...megas];

  const learnset = useMemo(
    () =>
      species.learnset
        .map((id) => lookup.getMove(id))
        .filter((m): m is NonNullable<typeof m> => !!m)
        .filter((m) => !moveQuery || m.name.toLowerCase().includes(moveQuery.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [species, lookup, moveQuery],
  );

  return (
    <div className="flex flex-col gap-3">
      <button onClick={onBack} className="label-caps self-start py-1 text-gold-400">
        ‹ Dex
      </button>

      <Panel
        title={forme.name}
        aside={
          formes.length > 1 && (
            <div className="flex gap-1">
              {formes.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setForme(f)}
                  className={`chamfer-sm px-1.5 py-0.5 font-display text-[0.7rem] font-semibold tracking-[0.1em] uppercase ${
                    forme.id === f.id
                      ? 'bg-gold-500 text-ink-950'
                      : 'border border-ink-700 text-ink-400'
                  }`}
                >
                  {f.baseSpecies ? f.name.replace(`${f.baseSpecies}-`, '') : 'Base'}
                </button>
              ))}
            </div>
          )
        }
      >
        <div className="flex items-start gap-4">
          <Sprite spriteId={forme.spriteId} size={72} />
          <div className="flex-1">
            <div className="flex gap-1.5">
              {forme.types.map((t) => (
                <TypeBadge key={t} type={t} size="sm" />
              ))}
            </div>
            <p className="mt-2 text-sm text-ink-300">
              {forme.abilities.map((a, i) => (
                <span key={a}>
                  {i > 0 && <span className="text-ink-600"> · </span>}
                  {a}
                </span>
              ))}
            </p>
            <button
              onClick={() => jumpToCalc(forme.name)}
              className="label-caps mt-2 text-gold-400"
            >
              Calc against ›
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-1.5">
          {STAT_IDS.map((id) => (
            <StatBar key={id} label={STAT_LABELS[id]} value={forme.baseStats[id]} max={200} />
          ))}
        </div>
      </Panel>

      <Suspense fallback={null}>
        <OhkoSweepPanel defenderName={forme.name} lookup={lookup} />
      </Suspense>

      <Panel title="Learnset" aside={<span className="label-caps">{learnset.length} moves</span>}>
        <input
          value={moveQuery}
          onChange={(e) => setMoveQuery(e.target.value)}
          placeholder="Filter moves…"
          className="mb-2 min-h-10 w-full border border-ink-700 bg-ink-850 px-2.5 text-sm outline-none placeholder:text-ink-500"
        />
        <ul className="max-h-80 overflow-y-auto">
          {learnset.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 border-b border-ink-800/60 py-1.5"
            >
              <TypeBadge type={m.type} size="sm" />
              <span className="flex-1 text-sm">{m.name}</span>
              <span className="label-caps">{m.category.slice(0, 4)}</span>
              <span className="stat-num w-8 text-right text-sm text-ink-300">
                {m.basePower || '—'}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
