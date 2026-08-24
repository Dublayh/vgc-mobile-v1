import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { AlignmentPicker } from '../../app/ui/AlignmentPicker';
import { Panel } from '../../app/ui/Panel';
import { SearchSelect } from '../../app/ui/SearchSelect';
import { Sprite } from '../../app/ui/Sprite';
import { TypeBadge } from '../../app/ui/TypeBadge';
import type { DexItem, DexLookup, DexMove, DexSpecies } from '../../data/dex';
import { useUsage } from '../../data/useUsage';
import { buildField, runCalc, toCalcPokemon, type DamageResult } from '../../engine/calc';
import { computeStats } from '../../engine/stats';
import {
  type AlignmentName,
  type ChampionsSet,
  SP_POOL,
  STAT_IDS,
  type Team,
} from '../../engine/types';
import { db } from '../../storage/db';
import { SPAllocator } from '../teams/SPAllocator';
import { usageMonToSet } from '../meta/threatSet';
import { useCalc, type BoostState, type CalcSelection } from './calcStore';
import { ComboPanel } from './ComboPanel';
import { speciesToSet } from './jumpToCalc';
import { MultiSweep } from './MultiSweep';
import { OptimizerPanel } from './OptimizerPanel';

interface SlotOption {
  teamId: string;
  slot: number;
  team: Team;
  set: ChampionsSet;
}

export function CalcView({ lookup }: { lookup: DexLookup }) {
  const teams = useLiveQuery(() => db.teams.toArray(), []);
  const calc = useCalc();
  const usage = useUsage();
  const [showPartner, setShowPartner] = useState(calc.attacker2 !== null);
  const [screen, setScreen] = useState<'matchup' | 'sweep'>('matchup');

  const slotOptions: SlotOption[] = useMemo(
    () =>
      (teams ?? []).flatMap((team) =>
        team.sets.map((set, slot) => ({ teamId: team.id, slot, team, set })),
      ),
    [teams],
  );

  const dexOptions = useMemo(
    () => [...lookup.species].sort((a, b) => a.name.localeCompare(b.name)),
    [lookup],
  );

  if (!teams) return null;

  const pickSlot = (o: SlotOption): CalcSelection => ({
    set: structuredClone(o.set),
    sourceLabel: o.team.name,
    fromTeam: true,
  });

  const pickSpecies = (sp: DexSpecies): CalcSelection => {
    const mon = usage?.get(sp.name);
    const set = (mon && usageMonToSet(mon, lookup)) || speciesToSet(sp, lookup);
    return { set, sourceLabel: mon ? 'meta set' : 'no usage data', fromTeam: false };
  };

  const updateSet =
    (role: 'attacker' | 'defender' | 'attacker2') => (patch: Partial<ChampionsSet>) => {
      const sel = calc[role];
      if (!sel) return;
      calc.patch({
        [role]: { ...sel, set: { ...sel.set, ...patch }, edited: true },
        expandedMove: null,
      });
    };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        {(
          [
            ['matchup', 'Matchup'],
            ['sweep', 'OHKO sweep'],
          ] as ['matchup' | 'sweep', string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setScreen(id)}
            className={`chamfer-sm px-3 py-1 font-display text-sm font-semibold tracking-[0.1em] uppercase ${
              screen === id ? 'bg-gold-500 text-ink-950' : 'border border-ink-700 text-ink-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {screen === 'sweep' && (
        <MultiSweep lookup={lookup} onVerified={() => setScreen('matchup')} />
      )}

      {screen === 'matchup' && (
        <>
      <PokemonPanel
        role="Attacker"
        selected={calc.attacker}
        slotOptions={slotOptions}
        dexOptions={dexOptions}
        lookup={lookup}
        onPick={(attacker) => calc.patch({ attacker, customMove: null, expandedMove: null })}
        pickSlot={pickSlot}
        pickSpecies={pickSpecies}
        onUpdateSet={updateSet('attacker')}
        boosts={calc.attackerBoosts}
        onBoosts={(attackerBoosts) => calc.patch({ attackerBoosts })}
        boostStats={['atk', 'spa']}
        extraToggle={{
          label: 'Burned',
          value: calc.attackerBurned,
          onChange: (attackerBurned) => calc.patch({ attackerBurned }),
        }}
      />

      {/* Partner/combined damage is a doubles concept. */}
      {calc.gameType === 'Doubles' && showPartner ? (
        <>
          <PokemonPanel
            role="Partner attacker"
            selected={calc.attacker2}
            slotOptions={slotOptions}
            dexOptions={dexOptions}
            lookup={lookup}
            onPick={(attacker2) => calc.patch({ attacker2 })}
            pickSlot={pickSlot}
            pickSpecies={pickSpecies}
            onUpdateSet={updateSet('attacker2')}
            boosts={calc.attacker2Boosts}
            onBoosts={(attacker2Boosts) => calc.patch({ attacker2Boosts })}
            boostStats={['atk', 'spa']}
          />
          <button
            onClick={() => {
              calc.patch({ attacker2: null });
              setShowPartner(false);
            }}
            className="label-caps self-start text-illegal"
          >
            ✕ Remove partner
          </button>
        </>
      ) : (
        calc.gameType === 'Doubles' &&
        calc.attacker && (
          <button
            onClick={() => setShowPartner(true)}
            className="label-caps self-start text-gold-400"
          >
            + Partner attacker (combined damage)
          </button>
        )
      )}

      <div className="flex justify-center">
        <button
          onClick={calc.swap}
          className="chamfer-sm border border-ink-700 px-3 py-1 font-display text-xs font-semibold tracking-[0.12em] uppercase text-ink-300 hover:border-gold-600 hover:text-gold-300"
        >
          ⇅ Swap
        </button>
      </div>

      <PokemonPanel
        role="Defender"
        selected={calc.defender}
        slotOptions={slotOptions}
        dexOptions={dexOptions}
        lookup={lookup}
        onPick={(defender) => calc.patch({ defender, expandedMove: null })}
        pickSlot={pickSlot}
        pickSpecies={pickSpecies}
        onUpdateSet={updateSet('defender')}
        boosts={calc.defenderBoosts}
        onBoosts={(defenderBoosts) => calc.patch({ defenderBoosts })}
        boostStats={['def', 'spd']}
      />

      <FieldControls />

      {calc.attacker && calc.defender && (
        <>
          <Results attacker={calc.attacker} defender={calc.defender} lookup={lookup} />
          {calc.gameType === 'Doubles' && calc.attacker2 && (
            <ComboPanel
              attacker={calc.attacker}
              partner={calc.attacker2}
              defender={calc.defender}
              lookup={lookup}
            />
          )}
          <OptimizerPanel
            attacker={calc.attacker}
            defender={calc.defender}
            lookup={lookup}
            onUpdateAttacker={updateSet('attacker')}
            onUpdateDefender={updateSet('defender')}
          />
        </>
      )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function PokemonPanel({
  role,
  selected,
  slotOptions,
  dexOptions,
  lookup,
  onPick,
  pickSlot,
  pickSpecies,
  onUpdateSet,
  boosts,
  onBoosts,
  boostStats,
  extraToggle,
}: {
  role: string;
  selected: CalcSelection | null;
  slotOptions: SlotOption[];
  dexOptions: DexSpecies[];
  lookup: DexLookup;
  onPick: (sel: CalcSelection) => void;
  pickSlot: (o: SlotOption) => CalcSelection;
  pickSpecies: (sp: DexSpecies) => CalcSelection;
  onUpdateSet: (patch: Partial<ChampionsSet>) => void;
  boosts: BoostState;
  onBoosts: (b: BoostState) => void;
  boostStats: (keyof BoostState)[];
  extraToggle?: { label: string; value: boolean; onChange: (v: boolean) => void };
}) {
  const [picking, setPicking] = useState(false);
  const [source, setSource] = useState<'teams' | 'dex'>(slotOptions.length ? 'teams' : 'dex');
  const [query, setQuery] = useState('');

  const showPicker = picking || !selected;

  return (
    <Panel
      title={role}
      aside={
        <button onClick={() => setPicking((v) => !v)} className="label-caps text-gold-400">
          {showPicker && selected ? 'Cancel' : selected ? 'Change' : 'Choose'}
        </button>
      }
    >
      {showPicker ? (
        <div>
          <div className="mb-2 flex gap-1.5">
            <Toggle
              label={`Teams (${slotOptions.length})`}
              value={source === 'teams'}
              onChange={() => setSource('teams')}
            />
            <Toggle label="Dex" value={source === 'dex'} onChange={() => setSource('dex')} />
          </div>

          {source === 'teams' ? (
            slotOptions.length === 0 ? (
              <p className="py-2 text-sm text-ink-500">No saved sets — use Dex, or build a team.</p>
            ) : (
              <ul className="max-h-64 overflow-y-auto">
                {slotOptions.map((o) => {
                  const sp = lookup.getSpecies(o.set.megaStone ?? o.set.species);
                  if (!sp) return null;
                  return (
                    <li key={`${o.teamId}-${o.slot}`}>
                      <button
                        onClick={() => {
                          onPick(pickSlot(o));
                          setPicking(false);
                        }}
                        className="flex w-full items-center gap-2.5 border-b border-ink-800/60 px-1 py-1.5 text-left hover:bg-ink-850"
                      >
                        <Sprite spriteId={sp.spriteId} size={32} />
                        <span className="flex-1">
                          <span className="font-display text-sm font-semibold tracking-wide uppercase">
                            {sp.name}
                          </span>
                          <span className="block text-xs text-ink-500">
                            {o.team.name} · {o.set.alignment}{' '}
                            {STAT_IDS.filter((id) => o.set.sp[id] > 0)
                              .map((id) => o.set.sp[id])
                              .join('/')}
                          </span>
                        </span>
                        {o.set.item && <span className="text-xs text-ink-400">{o.set.item}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            <div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the whole dex…"
                className="mb-1 min-h-10 w-full border border-ink-700 bg-ink-850 px-2.5 text-sm outline-none placeholder:text-ink-500 focus:border-gold-600"
              />
              <ul className="max-h-64 overflow-y-auto">
                {dexOptions
                  .filter((s) => !query || s.name.toLowerCase().includes(query.toLowerCase()))
                  .slice(0, 50)
                  .map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => {
                          onPick(pickSpecies(s));
                          setPicking(false);
                          setQuery('');
                        }}
                        className="flex w-full items-center gap-2.5 border-b border-ink-800/60 px-1 py-1.5 text-left hover:bg-ink-850"
                      >
                        <Sprite spriteId={s.spriteId} size={32} />
                        <span className="flex-1 font-display text-sm font-semibold tracking-wide uppercase">
                          {s.name}
                        </span>
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
          )}
        </div>
      ) : (
        <SelectedSummary
          selected={selected}
          lookup={lookup}
          onUpdateSet={onUpdateSet}
          boosts={boosts}
          onBoosts={onBoosts}
          boostStats={boostStats}
          extraToggle={extraToggle}
        />
      )}
    </Panel>
  );
}

function SelectedSummary({
  selected,
  lookup,
  onUpdateSet,
  boosts,
  onBoosts,
  boostStats,
  extraToggle,
}: {
  selected: CalcSelection;
  lookup: DexLookup;
  onUpdateSet: (patch: Partial<ChampionsSet>) => void;
  boosts: BoostState;
  onBoosts: (b: BoostState) => void;
  boostStats: (keyof BoostState)[];
  extraToggle?: { label: string; value: boolean; onChange: (v: boolean) => void };
}) {
  const { set } = selected;
  const [editing, setEditing] = useState(false);
  const species = lookup.getSpecies(set.megaStone ?? set.species);
  if (!species) return null;
  const stats = computeStats(species.baseStats, set.sp, set.alignment);
  const spTotal = STAT_IDS.reduce((sum, s) => sum + set.sp[s], 0);

  return (
    <div>
      <div className="flex items-center gap-3">
        <Sprite spriteId={species.spriteId} size={48} />
        <div className="flex-1">
          <p className="font-display text-lg font-bold tracking-wide uppercase italic">
            {species.name}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            {species.types.map((t) => (
              <TypeBadge key={t} type={t} size="sm" />
            ))}
            <span className="text-xs text-ink-400">
              {set.item ? `${set.item} · ` : ''}
              {set.alignment} · {spTotal}/{SP_POOL} SP
            </span>
          </div>
          <p className="mt-0.5 text-xs text-ink-500">
            {selected.fromTeam ? `from ${selected.sourceLabel}` : selected.sourceLabel}
            {selected.edited ? ' · edited (calc only)' : ''}
          </p>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className={`label-caps ${editing ? 'text-gold-300' : 'text-gold-400'}`}
        >
          {editing ? 'Done' : 'Edit set'}
        </button>
      </div>

      <p className="stat-num mt-2 text-xs text-ink-300">
        {stats.hp} HP / {stats.atk} Atk / {stats.def} Def / {stats.spa} SpA / {stats.spd} SpD /{' '}
        {stats.spe} Spe
      </p>

      {!selected.fromTeam && (
        <SpreadChips speciesName={species.name} set={set} onUpdate={onUpdateSet} />
      )}

      {editing && (
        <SetScratchEditor set={set} species={species} lookup={lookup} onUpdate={onUpdateSet} />
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {boostStats.map((stat) => (
          <div key={stat} className="flex items-center gap-1">
            <span className="label-caps">{stat}</span>
            <button
              onClick={() => onBoosts({ ...boosts, [stat]: Math.max(-6, boosts[stat] - 1) })}
              className="h-7 w-7 border border-ink-700 font-mono text-sm text-ink-300"
            >
              −
            </button>
            <span
              className={`stat-num w-7 text-center text-sm ${
                boosts[stat] > 0 ? 'text-gold-400' : boosts[stat] < 0 ? 'text-illegal' : 'text-ink-500'
              }`}
            >
              {boosts[stat] > 0 ? `+${boosts[stat]}` : boosts[stat]}
            </span>
            <button
              onClick={() => onBoosts({ ...boosts, [stat]: Math.min(6, boosts[stat] + 1) })}
              className="h-7 w-7 border border-ink-700 font-mono text-sm text-ink-300"
            >
              +
            </button>
          </div>
        ))}
        {extraToggle && (
          <Toggle
            label={extraToggle.label}
            value={extraToggle.value}
            onChange={extraToggle.onChange}
          />
        )}
      </div>
    </div>
  );
}

/** One-tap switch between the mon's top ladder spreads (dex-sourced panels). */
function SpreadChips({
  speciesName,
  set,
  onUpdate,
}: {
  speciesName: string;
  set: ChampionsSet;
  onUpdate: (patch: Partial<ChampionsSet>) => void;
}) {
  const usage = useUsage();
  const mon = usage?.get(speciesName) ?? usage?.get(set.species);
  if (!mon || mon.spreads.length < 2) return null;

  const isCurrent = (s: (typeof mon.spreads)[number]) =>
    s.alignment === set.alignment && STAT_IDS.every((id) => s.sp[id] === set.sp[id]);

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {mon.spreads.slice(0, 5).map((s, i) => (
        <button
          key={i}
          onClick={() => onUpdate({ alignment: s.alignment as AlignmentName, sp: { ...s.sp } })}
          className={`chamfer-sm px-2 py-0.5 font-display text-[0.7rem] font-semibold tracking-[0.06em] uppercase ${
            isCurrent(s)
              ? 'bg-gold-500 text-ink-950'
              : 'border border-ink-700 text-ink-400 hover:border-gold-600 hover:text-gold-300'
          }`}
        >
          {s.alignment}{' '}
          <span className="stat-num normal-case">
            {STAT_IDS.filter((id) => s.sp[id] > 0)
              .map((id) => s.sp[id])
              .join('/')}
          </span>{' '}
          <span className="opacity-60">{(s.pct * 100).toFixed(0)}%</span>
        </button>
      ))}
    </div>
  );
}

/** Inline scratch editing of the working copy (never writes back to teams). */
function SetScratchEditor({
  set,
  species,
  lookup,
  onUpdate,
}: {
  set: ChampionsSet;
  species: DexSpecies;
  lookup: DexLookup;
  onUpdate: (patch: Partial<ChampionsSet>) => void;
}) {
  const usage = useUsage();
  const mon = usage?.get(species.name) ?? usage?.get(set.species);
  const baseSpecies = lookup.getSpecies(set.species) ?? species;

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
          (itemUsage.get(b.id) ?? -1) - (itemUsage.get(a.id) ?? -1) ||
          a.name.localeCompare(b.name),
      ),
    [lookup, itemUsage],
  );

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-ink-800 pt-3">
      {mon && mon.spreads.length > 0 && (
        <div>
          <p className="label-caps mb-1.5">Meta spreads</p>
          <div className="flex flex-wrap gap-1.5">
            {mon.spreads.slice(0, 5).map((s, i) => (
              <button
                key={i}
                onClick={() =>
                  onUpdate({ alignment: s.alignment as AlignmentName, sp: { ...s.sp } })
                }
                className="chamfer-sm border border-ink-700 px-2 py-1 font-display text-xs font-semibold tracking-[0.06em] uppercase text-ink-300 hover:border-gold-600 hover:text-gold-300"
              >
                {s.alignment}{' '}
                <span className="stat-num normal-case">
                  {STAT_IDS.filter((id) => s.sp[id] > 0)
                    .map((id) => s.sp[id])
                    .join('/')}
                </span>{' '}
                <span className="text-ink-500">{(s.pct * 100).toFixed(0)}%</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="label-caps mb-1.5">Alignment</p>
        <AlignmentPicker
          key={set.alignment}
          value={set.alignment}
          onChange={(alignment) => onUpdate({ alignment })}
        />
      </div>

      <SPAllocator
        baseStats={species.baseStats}
        sp={set.sp}
        alignment={set.alignment}
        onChange={(sp) => onUpdate({ sp })}
      />

      <div>
        <p className="label-caps mb-1.5">Item</p>
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
            renderValue={(i) => <ItemRow item={i} pct={itemUsage.get(i.id)} />}
            renderOption={(i) => <ItemRow item={i} pct={itemUsage.get(i.id)} />}
            onSelect={(i) => onUpdate({ item: i.name })}
            onClear={() => onUpdate({ item: undefined })}
          />
        )}
      </div>

      <div>
        <p className="label-caps mb-1.5">Ability</p>
        {set.megaStone ? (
          // Mega formes have exactly one ability — offer it, never the base's.
          <p className="px-0.5 text-sm text-ink-300">
            {species.abilities[0]}
            <span className="ml-2 text-xs text-ink-500">(fixed on mega)</span>
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {baseSpecies.abilities.map((ab) => (
              <button
                key={ab}
                onClick={() => onUpdate({ ability: ab })}
                className={`chamfer-sm px-2.5 py-1 font-display text-xs font-semibold tracking-[0.08em] uppercase ${
                  set.ability === ab
                    ? 'bg-gold-500 text-ink-950'
                    : 'border border-ink-700 text-ink-300'
                }`}
              >
                {ab}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`chamfer-sm px-2 py-1 font-display text-xs font-semibold tracking-[0.1em] uppercase ${
        value ? 'bg-gold-500 text-ink-950' : 'border border-ink-700 text-ink-400'
      }`}
    >
      {label}
    </button>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  none,
}: {
  value: T | undefined;
  options: T[];
  onChange: (v: T | undefined) => void;
  none?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {none && (
        <Toggle label={none} value={value === undefined} onChange={() => onChange(undefined)} />
      )}
      {options.map((o) => (
        <Toggle key={o} label={o} value={value === o} onChange={(on) => onChange(on ? o : undefined)} />
      ))}
    </div>
  );
}

function FieldControls() {
  const calc = useCalc();
  return (
    <Panel title="Field">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span className="label-caps w-14">Mode</span>
          <Toggle
            label="Doubles"
            value={calc.gameType === 'Doubles'}
            onChange={() => calc.patch({ gameType: 'Doubles' })}
          />
          <Toggle
            label="Singles"
            value={calc.gameType === 'Singles'}
            onChange={() => calc.patch({ gameType: 'Singles' })}
          />
          <Toggle label="Crit" value={calc.isCrit} onChange={(isCrit) => calc.patch({ isCrit })} />
        </div>
        <div className="flex items-start gap-2">
          <span className="label-caps w-14 pt-1.5">Weather</span>
          <Segmented
            value={calc.weather}
            options={['Sun', 'Rain', 'Sand', 'Snow']}
            onChange={(weather) => calc.patch({ weather })}
            none="None"
          />
        </div>
        <div className="flex items-start gap-2">
          <span className="label-caps w-14 pt-1.5">Terrain</span>
          <Segmented
            value={calc.terrain}
            options={['Electric', 'Grassy', 'Psychic', 'Misty']}
            onChange={(terrain) => calc.patch({ terrain })}
            none="None"
          />
        </div>
        <div className="flex items-start gap-2">
          <span className="label-caps w-14 pt-1.5">Sides</span>
          <div className="flex flex-wrap gap-1.5">
            <Toggle
              label="Helping Hand"
              value={calc.helpingHand}
              onChange={(helpingHand) => calc.patch({ helpingHand })}
            />
            <Toggle
              label="Reflect"
              value={calc.screens.reflect}
              onChange={(v) => calc.patch({ screens: { ...calc.screens, reflect: v } })}
            />
            <Toggle
              label="Light Screen"
              value={calc.screens.lightScreen}
              onChange={(v) => calc.patch({ screens: { ...calc.screens, lightScreen: v } })}
            />
            <Toggle
              label="Aurora Veil"
              value={calc.screens.auroraVeil}
              onChange={(v) => calc.patch({ screens: { ...calc.screens, auroraVeil: v } })}
            />
            <Toggle
              label="Friend Guard"
              value={calc.friendGuard}
              onChange={(friendGuard) => calc.patch({ friendGuard })}
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------

function Results({
  attacker,
  defender,
  lookup,
}: {
  attacker: CalcSelection;
  defender: CalcSelection;
  lookup: DexLookup;
}) {
  const calc = useCalc();
  const [copied, setCopied] = useState(false);

  // Any attacker can test an extra learnset move on top of its set's moves.
  const savedMoves = attacker.set.moves.filter((m): m is string => !!m);
  const moveNames = [...savedMoves];
  if (
    calc.customMove &&
    !savedMoves.some((m) => m.toLowerCase() === calc.customMove!.toLowerCase())
  ) {
    moveNames.push(calc.customMove);
  }

  const learnsetOptions = useMemo(() => {
    const base = lookup.getSpecies(attacker.set.species);
    return (base?.learnset ?? [])
      .map((id) => lookup.getMove(id))
      .filter((m): m is DexMove => !!m && m.category !== 'Status')
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [attacker.set.species, lookup]);

  const [showSweep, setShowSweep] = useState(false);

  const combatants = useMemo(() => {
    const field = buildField({
      gameType: calc.gameType,
      weather: calc.weather,
      terrain: calc.terrain,
      attackerSide: { isHelpingHand: calc.helpingHand },
      defenderSide: {
        isReflect: calc.screens.reflect,
        isLightScreen: calc.screens.lightScreen,
        isAuroraVeil: calc.screens.auroraVeil,
        isFriendGuard: calc.friendGuard,
      },
    });
    const atk = toCalcPokemon(attacker.set, {
      formeName: attacker.set.megaStone,
      boosts: calc.attackerBoosts,
      status: calc.attackerBurned ? 'brn' : '',
    });
    const def = toCalcPokemon(defender.set, {
      formeName: defender.set.megaStone,
      boosts: calc.defenderBoosts,
    });
    return { field, atk, def };
  }, [attacker, defender, calc]);

  const rows = useMemo(() => {
    const { field, atk, def } = combatants;
    return moveNames.map((moveName) => {
      try {
        return {
          moveName,
          result: runCalc(atk, def, moveName, field, { isCrit: calc.isCrit }),
        };
      } catch {
        return { moveName, result: null };
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combatants, calc.isCrit, moveNames.join('|')]);

  /** Whole-learnset sweep: the attacker's strongest options into THIS defender. */
  const sweep = useMemo(() => {
    if (!showSweep) return [];
    const { field, atk, def } = combatants;
    return learnsetOptions
      .map((move) => {
        try {
          return { move, result: runCalc(atk, def, move.name, field, { isCrit: calc.isCrit }) };
        } catch {
          return null;
        }
      })
      .filter((x): x is { move: DexMove; result: DamageResult } => !!x && x.result.maxPercent > 0)
      .sort((a, b) => b.result.maxPercent - a.result.maxPercent)
      .slice(0, 10);
  }, [showSweep, combatants, learnsetOptions, calc.isCrit]);

  const best = rows.reduce(
    (acc, r, i) => (r.result && r.result.maxPercent > (rows[acc]?.result?.maxPercent ?? -1) ? i : acc),
    -1,
  );

  const copy = async (result: DamageResult) => {
    try {
      await navigator.clipboard.writeText(result.description);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — the text is visible on screen anyway */
    }
  };

  return (
    <Panel title="Damage" aside={copied ? <span className="text-xs text-legal">Copied</span> : undefined}>
      {learnsetOptions.length > 0 && (
        <div className="mb-2">
          <p className="label-caps mb-1.5">
            {savedMoves.length ? 'Test another move (from learnset)' : 'Attacker move (from learnset)'}
          </p>
          <SearchSelect<DexMove>
            value={calc.customMove ? lookup.getMove(calc.customMove) : undefined}
            placeholder="Pick a move…"
            options={learnsetOptions}
            keyOf={(m) => m.id}
            filter={(m, q) => m.name.toLowerCase().includes(q)}
            renderValue={(m) => <MoveRow move={m} />}
            renderOption={(m) => <MoveRow move={m} />}
            onSelect={(m) => calc.patch({ customMove: m.name, expandedMove: null })}
            onClear={() => calc.patch({ customMove: null, expandedMove: null })}
          />
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-ink-500">Pick a move above to run the calc.</p>
      ) : (
        <div className="flex flex-col">
          {rows.map(({ moveName, result }, i) => {
            const move = lookup.getMove(moveName);
            const expanded = calc.expandedMove === i;
            return (
              <div key={moveName} className="border-b border-ink-800/60 last:border-0">
                <button
                  onClick={() => calc.patch({ expandedMove: expanded ? null : i })}
                  className="flex w-full items-center gap-2 py-2 text-left"
                >
                  {move && <TypeBadge type={move.type} size="sm" />}
                  <span className="flex-1 text-sm">{moveName}</span>
                  {result && result.maxPercent > 0 ? (
                    <>
                      <span
                        className={`stat-num text-sm ${i === best ? 'text-gold-300' : 'text-ink-200'}`}
                      >
                        {result.percentRange}
                      </span>
                      <span className="label-caps shrink-0 text-right text-xs">
                        {shortKO(result.koChance)}
                      </span>
                    </>
                  ) : (
                    <span className="stat-num text-sm text-ink-500">—</span>
                  )}
                </button>
                {expanded && result && (
                  <div className="pb-2.5 pl-1">
                    <div className="mb-1.5 h-2 bg-ink-800">
                      <div
                        className={`h-full ${result.maxPercent >= 100 ? 'bg-illegal' : 'bg-gold-500'}`}
                        style={{ width: `${Math.min(100, result.maxPercent)}%` }}
                      />
                    </div>
                    <p className="stat-num text-xs break-all text-ink-400">
                      [{result.rolls.join(', ')}]
                    </p>
                    <p className="mt-1.5 text-xs text-ink-300">{result.description}</p>
                    <button
                      onClick={() => copy(result)}
                      className="label-caps mt-1.5 text-gold-400"
                    >
                      Copy calc
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {learnsetOptions.length > 0 && (
        <div className="mt-2 border-t border-ink-800 pt-2">
          <button
            onClick={() => setShowSweep((v) => !v)}
            className={`label-caps ${showSweep ? 'text-gold-300' : 'text-gold-400'}`}
          >
            {showSweep ? '▾ Top learnset moves vs this defender' : '▸ Top learnset moves vs this defender'}
          </button>
          {showSweep && (
            <ul className="mt-1.5 flex flex-col">
              {sweep.map(({ move, result }) => (
                <li key={move.id}>
                  <button
                    onClick={() => calc.patch({ customMove: move.name, expandedMove: null })}
                    className="flex w-full items-center gap-2 border-b border-ink-800/40 py-1.5 text-left last:border-0 hover:bg-ink-850"
                    title="Add to the rows above"
                  >
                    <TypeBadge type={move.type} size="sm" />
                    <span className="flex-1 text-sm">{move.name}</span>
                    <span className="stat-num text-sm text-ink-200">{result.percentRange}</span>
                    <span className="label-caps shrink-0 text-xs">{shortKO(result.koChance)}</span>
                  </button>
                </li>
              ))}
              {sweep.length === 0 && (
                <li className="py-1.5 text-xs text-ink-500">
                  Nothing in the learnset damages this defender.
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

function ItemRow({ item, pct }: { item: DexItem; pct?: number }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="flex-1">{item.name}</span>
      {pct !== undefined && (
        <span className="stat-num shrink-0 text-[0.7rem] text-gold-400">
          {(pct * 100).toFixed(0)}%
        </span>
      )}
    </span>
  );
}

function MoveRow({ move }: { move: DexMove }) {
  return (
    <span className="flex items-center gap-2">
      <TypeBadge type={move.type} size="sm" />
      <span className="flex-1">{move.name}</span>
      <span className="label-caps">{move.category.slice(0, 4)}</span>
      <span className="stat-num w-7 text-right text-xs text-ink-300">{move.basePower || '—'}</span>
    </span>
  );
}

function shortKO(text: string): string {
  if (!text) return '';
  const m = text.match(/(guaranteed|\d+(?:\.\d+)?%) (?:chance to )?(OHKO|\d+HKO)/);
  if (!m) return text.length > 18 ? '' : text;
  return m[1] === 'guaranteed' ? m[2] : `${m[1]} ${m[2]}`;
}
