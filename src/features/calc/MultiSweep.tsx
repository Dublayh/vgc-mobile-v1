/**
 * Multi-target OHKO sweep (Calc › Sweep): "who OHKOs Tyranitar AND Kingambit?"
 * Sweeps every regulation forme at max offensive investment against up to four
 * usage-seeded targets and ranks attackers by their WEAKEST matchup, so the
 * top of the list answers the whole core. Same engine + result list as the
 * dex "Who OHKOs this?" panel (useOhkoSweep / SweepResults).
 */
import { useState } from 'react';
import { Button } from '../../app/ui/Button';
import { Segmented } from '../../app/ui/Chip';
import { Panel } from '../../app/ui/Panel';
import { SearchSelect } from '../../app/ui/SearchSelect';
import { Sprite } from '../../app/ui/Sprite';
import { POKEMON_TYPES, TypeBadge } from '../../app/ui/TypeBadge';
import type { DexAbility, DexLookup, DexSpecies } from '../../data/dex';
import { useUsage } from '../../data/useUsage';
import { SweepResults } from '../analysis/SweepResults';
import {
  useOhkoSweep,
  useVerifyInCalc,
  type MatchMode,
  type SweepTarget,
} from '../analysis/useOhkoSweep';
import { SpeciesSearch } from '../dex/SpeciesSearch';
import { seedSelection } from './jumpToCalc';

const MAX_TARGETS = 4;

export function MultiSweep({ lookup }: { lookup: DexLookup }) {
  const usage = useUsage();
  const sweep = useOhkoSweep(lookup);
  const verify = useVerifyInCalc(lookup);

  const [targets, setTargets] = useState<SweepTarget[]>([]);
  const [matchMode, setMatchMode] = useState<MatchMode>('all');
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterAbility, setFilterAbility] = useState<DexAbility | undefined>();

  const addTarget = (species: DexSpecies) => {
    const { set, sourceLabel } = seedSelection(species, usage, lookup);
    setTargets([...targets, { species, set, sourceLabel }]);
    sweep.reset();
  };
  const filtered = filterTypes.length > 0 || !!filterAbility;
  const run = () =>
    sweep.run(targets, {
      matchMode,
      attackerFilter: (s) =>
        filterTypes.every((ft) => s.types.some((st) => st.toLowerCase() === ft)) &&
        (!filterAbility || s.abilities.includes(filterAbility.name)),
    });

  const targetLabel =
    targets.length === 1 ? targets[0].species.name : matchMode === 'all' ? `all ${targets.length}` : 'any of them';

  return (
    <div className="flex flex-col gap-3">
      <Panel title="Targets" aside={<span className="label-caps">{targets.length}/{MAX_TARGETS}</span>}>
        {targets.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {targets.map((t) => (
              <button
                key={t.species.id}
                onClick={() => {
                  setTargets(targets.filter((x) => x.species.name !== t.species.name));
                  sweep.reset();
                }}
                className="chamfer-sm flex items-center gap-1.5 border border-gold-600/50 bg-gold-950 px-2 py-1 font-display text-xs font-semibold tracking-wide uppercase text-gold-300"
                title="Remove target"
              >
                <Sprite spriteId={t.species.spriteId} size={22} />
                {t.species.name} ✕
              </button>
            ))}
          </div>
        )}
        {targets.length < MAX_TARGETS && (
          <SpeciesSearch
            species={lookup.species.filter((s) => !targets.some((t) => t.species.name === s.name))}
            lookup={lookup}
            usage={usage}
            onPick={addTarget}
            placeholder="Add a target (usage-ranked)…"
            limit={30}
            showTypes={false}
            spriteSize={28}
            listClass="max-h-48 overflow-y-auto"
          />
        )}
      </Panel>

      {targets.length > 0 && (
        <Panel title="Attacker filters" aside={<span className="label-caps">optional</span>}>
          <div className="flex flex-col gap-2.5">
            {targets.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="label-caps w-16">Must KO</span>
                <Segmented<MatchMode>
                  value={matchMode}
                  options={[
                    { value: 'all', label: 'All targets' },
                    { value: 'any', label: 'Any target' },
                  ]}
                  onChange={(m) => {
                    setMatchMode(m);
                    sweep.reset();
                  }}
                />
              </div>
            )}
            <div className="flex items-start gap-1.5">
              <span className="label-caps w-16 pt-1">Type</span>
              <div className="flex flex-1 flex-wrap gap-1">
                {POKEMON_TYPES.map((pt) => (
                  <button
                    key={pt}
                    onClick={() => {
                      setFilterTypes(
                        filterTypes.includes(pt) ? filterTypes.filter((x) => x !== pt) : [...filterTypes, pt],
                      );
                      sweep.reset();
                    }}
                    className={filterTypes.includes(pt) ? '' : 'opacity-40'}
                  >
                    <TypeBadge type={pt} size="sm" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="label-caps w-16">Ability</span>
              <div className="flex-1">
                <SearchSelect<DexAbility>
                  value={filterAbility}
                  placeholder="Any ability"
                  options={lookup.abilities}
                  keyOf={(a) => a.id}
                  filter={(a, q) => a.name.toLowerCase().includes(q)}
                  renderValue={(a) => <span>{a.name}</span>}
                  renderOption={(a) => (
                    <span className="flex flex-col">
                      <span>{a.name}</span>
                      {a.shortDesc && <span className="text-xs text-ink-500">{a.shortDesc}</span>}
                    </span>
                  )}
                  onSelect={(a) => {
                    setFilterAbility(a);
                    sweep.reset();
                  }}
                  onClear={() => {
                    setFilterAbility(undefined);
                    sweep.reset();
                  }}
                />
              </div>
            </div>
          </div>
        </Panel>
      )}

      {targets.length > 0 && sweep.rows === null && (
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={run} disabled={sweep.running}>
            {sweep.running
              ? `Sweeping… ${sweep.progress}%`
              : `Who OHKOs ${targets.length === 1 ? 'it' : targetLabel}?`}
          </Button>
          {sweep.running && (
            <div className="h-1.5 flex-1 bg-ink-800">
              <div className="h-full bg-gold-500" style={{ width: `${sweep.progress}%` }} />
            </div>
          )}
        </div>
      )}

      {sweep.rows !== null && (
        <Panel
          title={`OHKOs ${targets.length === 1 ? targetLabel : matchMode === 'all' ? `all ${targets.length} targets` : 'at least one target'}`}
          aside={
            <span className="stat-num text-xs text-illegal">
              {sweep.rows.filter((r) => r.score >= 100).length} can
            </span>
          }
        >
          <SweepResults
            rows={sweep.rows}
            targets={targets}
            matchMode={matchMode}
            gameMode={sweep.gameMode}
            filtered={filtered}
            onVerify={(row, idx, option) => verify(row, targets[idx], idx, option)}
          />
        </Panel>
      )}
    </div>
  );
}
