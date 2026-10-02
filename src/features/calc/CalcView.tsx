import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useUI, type CalcScreen } from '../../app/store';
import { AlignmentPicker } from '../../app/ui/AlignmentPicker';
import { Chip, Segmented } from '../../app/ui/Chip';
import { spreadLabel } from '../../app/ui/format';
import { Panel } from '../../app/ui/Panel';
import { SearchSelect } from '../../app/ui/SearchSelect';
import { Sprite } from '../../app/ui/Sprite';
import { TypeBadge } from '../../app/ui/TypeBadge';
import { useCopy } from '../../app/ui/useCopy';
import type { DexLookup, DexMove, DexSpecies } from '../../data/dex';
import { useUsage } from '../../data/useUsage';
import { runCalc, type DamageResult } from '../../engine/calc';
import { computeStats } from '../../engine/stats';
import { type ChampionsSet, SP_POOL, STAT_IDS, type Team } from '../../engine/types';
import { db } from '../../storage/db';
import { SpeciesSearch } from '../dex/SpeciesSearch';
import {
  AbilityField,
  Field,
  ItemField,
  MoveRow,
  SpreadChips,
  useSetUsage,
} from '../teams/fields';
import { SPAllocator } from '../teams/SPAllocator';
import { useCalc, type BoostState, type CalcSelection, type CalcState } from './calcStore';
import { combatantsFromState } from './combatants';
import { ComboPanel } from './ComboPanel';
import { seedSelection } from './jumpToCalc';
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
  const { calcScreen, openCalc } = useUI();
  const [showPartner, setShowPartner] = useState(calc.attacker2 !== null);

  const slotOptions: SlotOption[] = useMemo(
    () =>
      (teams ?? []).flatMap((team) =>
        team.sets.map((set, slot) => ({ teamId: team.id, slot, team, set })),
      ),
    [teams],
  );

  if (!teams) return null;

  const pickSlot = (o: SlotOption): CalcSelection => ({
    set: structuredClone(o.set),
    sourceLabel: o.team.name,
    fromTeam: true,
  });
  const pickSpecies = (sp: DexSpecies) => seedSelection(sp, usage, lookup);

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
      <Segmented<CalcScreen>
        size="md"
        value={calcScreen}
        options={[
          { value: 'matchup', label: 'Matchup' },
          { value: 'sweep', label: 'OHKO sweep' },
        ]}
        onChange={openCalc}
      />

      {calcScreen === 'sweep' && <MultiSweep lookup={lookup} />}

      {calcScreen === 'matchup' && (
        <>
          <PokemonPanel
            role="Attacker"
            selected={calc.attacker}
            slotOptions={slotOptions}
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
              <button onClick={() => setShowPartner(true)} className="label-caps self-start text-gold-400">
                + Partner attacker (combined damage)
              </button>
            )
          )}

          <div className="flex justify-center">
            <Chip active={false} onClick={calc.swap} className="tracking-[0.12em]">
              ⇅ Swap
            </Chip>
          </div>

          <PokemonPanel
            role="Defender"
            selected={calc.defender}
            slotOptions={slotOptions}
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
  const usage = useUsage();
  const [picking, setPicking] = useState(false);
  const [source, setSource] = useState<'teams' | 'dex'>(slotOptions.length ? 'teams' : 'dex');

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
          <Segmented<'teams' | 'dex'>
            className="mb-2"
            value={source}
            options={[
              { value: 'teams', label: `Teams (${slotOptions.length})` },
              { value: 'dex', label: 'Dex' },
            ]}
            onChange={setSource}
          />

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
                            {o.team.name} · {o.set.alignment} {spreadLabel(o.set.sp)}
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
            <SpeciesSearch
              species={lookup.species}
              lookup={lookup}
              usage={usage}
              placeholder="Search the whole dex…"
              onPick={(s) => {
                onPick(pickSpecies(s));
                setPicking(false);
              }}
            />
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
  const { mon, itemUsage, itemOptions } = useSetUsage(set, lookup);
  const forme = lookup.getSpecies(set.megaStone ?? set.species);
  const base = lookup.getSpecies(set.species) ?? forme;
  if (!forme || !base) return null;
  const stats = computeStats(forme.baseStats, set.sp, set.alignment);
  const spTotal = STAT_IDS.reduce((sum, s) => sum + set.sp[s], 0);

  return (
    <div>
      <div className="flex items-center gap-3">
        <Sprite spriteId={forme.spriteId} size={48} />
        <div className="flex-1">
          <p className="font-display text-lg font-bold tracking-wide uppercase italic">{forme.name}</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            {forme.types.map((t) => (
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

      {/* One-tap switch between the mon's top ladder spreads (dex-sourced or editing). */}
      {mon && (!selected.fromTeam || editing) && mon.spreads.length > 0 && (
        <div className="mt-2">
          <SpreadChips
            size="xs"
            spreads={mon.spreads.slice(0, 5)}
            current={{ alignment: set.alignment, sp: set.sp }}
            onPick={(alignment, sp) => onUpdateSet({ alignment, sp })}
          />
        </div>
      )}

      {editing && (
        <div className="mt-3 flex flex-col gap-3 border-t border-ink-800 pt-3">
          <Field label="Alignment">
            <AlignmentPicker value={set.alignment} onChange={(alignment) => onUpdateSet({ alignment })} />
          </Field>
          <SPAllocator
            baseStats={forme.baseStats}
            sp={set.sp}
            alignment={set.alignment}
            onChange={(sp) => onUpdateSet({ sp })}
          />
          <Field label="Item">
            <ItemField
              set={set}
              lookup={lookup}
              itemOptions={itemOptions}
              itemUsage={itemUsage}
              onChange={(item) => onUpdateSet({ item })}
            />
          </Field>
          <Field label="Ability">
            <AbilityField set={set} base={base} forme={forme} onChange={(ability) => onUpdateSet({ ability })} />
          </Field>
        </div>
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
          <Chip active={extraToggle.value} onClick={() => extraToggle.onChange(!extraToggle.value)}>
            {extraToggle.label}
          </Chip>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

type Weather = CalcState['weather'];
type Terrain = CalcState['terrain'];

function FieldControls() {
  const calc = useCalc();
  const flag = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <Chip active={value} onClick={() => onChange(!value)}>
      {label}
    </Chip>
  );
  return (
    <Panel title="Field">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span className="label-caps w-14">Mode</span>
          <Segmented<'Doubles' | 'Singles'>
            value={calc.gameType}
            options={[
              { value: 'Doubles', label: 'Doubles' },
              { value: 'Singles', label: 'Singles' },
            ]}
            onChange={(gameType) => calc.patch({ gameType })}
          />
          {flag('Crit', calc.isCrit, (isCrit) => calc.patch({ isCrit }))}
        </div>
        <div className="flex items-start gap-2">
          <span className="label-caps w-14 pt-1.5">Weather</span>
          <Segmented<Weather>
            value={calc.weather}
            options={[undefined, 'Sun', 'Rain', 'Sand', 'Snow'].map((w) => ({
              value: w as Weather,
              label: w ?? 'None',
            }))}
            onChange={(weather) => calc.patch({ weather })}
          />
        </div>
        <div className="flex items-start gap-2">
          <span className="label-caps w-14 pt-1.5">Terrain</span>
          <Segmented<Terrain>
            value={calc.terrain}
            options={[undefined, 'Electric', 'Grassy', 'Psychic', 'Misty'].map((t) => ({
              value: t as Terrain,
              label: t ?? 'None',
            }))}
            onChange={(terrain) => calc.patch({ terrain })}
          />
        </div>
        <div className="flex items-start gap-2">
          <span className="label-caps w-14 pt-1.5">Sides</span>
          <div className="flex flex-wrap gap-1.5">
            {flag('Helping Hand', calc.helpingHand, (helpingHand) => calc.patch({ helpingHand }))}
            {flag('Reflect', calc.screens.reflect, (v) =>
              calc.patch({ screens: { ...calc.screens, reflect: v } }),
            )}
            {flag('Light Screen', calc.screens.lightScreen, (v) =>
              calc.patch({ screens: { ...calc.screens, lightScreen: v } }),
            )}
            {flag('Aurora Veil', calc.screens.auroraVeil, (v) =>
              calc.patch({ screens: { ...calc.screens, auroraVeil: v } }),
            )}
            {flag('Friend Guard', calc.friendGuard, (friendGuard) => calc.patch({ friendGuard }))}
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
  const { copied, copy } = useCopy(1800);

  // Any attacker can test an extra learnset move on top of its set's moves.
  const savedMoves = attacker.set.moves.filter((m): m is string => !!m);
  const moveNames = [...savedMoves];
  if (calc.customMove && !savedMoves.some((m) => m.toLowerCase() === calc.customMove!.toLowerCase())) {
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

  const combatants = useMemo(
    () => combatantsFromState(calc, attacker, defender),
    [attacker, defender, calc],
  );

  const rows = useMemo(() => {
    const { field, atk, def } = combatants;
    return moveNames.map((moveName) => {
      try {
        return { moveName, result: runCalc(atk, def, moveName, field, { isCrit: calc.isCrit }) };
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
                      <span className={`stat-num text-sm ${i === best ? 'text-gold-300' : 'text-ink-200'}`}>
                        {result.percentRange}
                      </span>
                      <span className="label-caps shrink-0 text-right text-xs">{shortKO(result.koChance)}</span>
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
                    <p className="stat-num text-xs break-all text-ink-400">[{result.rolls.join(', ')}]</p>
                    <p className="mt-1.5 text-xs text-ink-300">{result.description}</p>
                    <button onClick={() => copy(result.description)} className="label-caps mt-1.5 text-gold-400">
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
                <li className="py-1.5 text-xs text-ink-500">Nothing in the learnset damages this defender.</li>
              )}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

function shortKO(text: string): string {
  if (!text) return '';
  const m = text.match(/(guaranteed|\d+(?:\.\d+)?%) (?:chance to )?(OHKO|\d+HKO)/);
  if (!m) return text.length > 18 ? '' : text;
  return m[1] === 'guaranteed' ? m[2] : `${m[1]} ${m[2]}`;
}
