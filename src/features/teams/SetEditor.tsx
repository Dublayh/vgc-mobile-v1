import { useUI } from '../../app/store';
import { AlignmentPicker } from '../../app/ui/AlignmentPicker';
import { Chip } from '../../app/ui/Chip';
import { Icon } from '../../app/ui/Icon';
import { SearchSelect } from '../../app/ui/SearchSelect';
import { Sprite } from '../../app/ui/Sprite';
import { TypeBadge } from '../../app/ui/TypeBadge';
import type { DexLookup, DexMove } from '../../data/dex';
import { setViolations } from '../../engine/legality';
import type { ChampionsSet, Team } from '../../engine/types';
import { updateSet } from '../../storage/teams';
import { SpeciesSearch } from '../dex/SpeciesSearch';
import {
  AbilityField,
  Field,
  ItemField,
  MoveRow,
  SpreadChips,
  useMoveOptions,
  useSetUsage,
} from './fields';
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
  const { usage, mon, moveUsage, itemUsage, itemOptions } = useSetUsage(set, lookup);
  const moveOptions = useMoveOptions(species, moveUsage, lookup);

  const back = (
    <button onClick={() => openSlot(null)} className="label-caps self-start py-1 text-gold-400">
      ‹ {team.name}
    </button>
  );

  if (!set) {
    return (
      <div className="flex flex-col gap-3">
        {back}
        <p className="label-caps">Choose a species</p>
        <SpeciesSearch
          species={lookup.roster}
          lookup={lookup}
          usage={usage}
          autoFocus
          limit={Infinity}
          spriteSize={36}
          listClass="chamfer border border-ink-800 bg-ink-900"
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
        <Field label="Forme">
          <div className="flex gap-1.5">
            <Chip size="md" active={!set.megaStone} onClick={() => patch({ megaStone: undefined })}>
              Base
            </Chip>
            {megas.map((m) => (
              <Chip
                key={m.id}
                size="md"
                active={set.megaStone === m.name}
                // Megas must hold their stone (ladder-verified) — set it too.
                onClick={() => patch({ megaStone: m.name, item: lookup.stoneFor(m.name)?.name ?? set.item })}
              >
                {m.name.replace(`${species.name}-`, '')}
              </Chip>
            ))}
          </div>
        </Field>
      )}

      <Field label="Ability">
        <AbilityField set={set} base={species} forme={active} onChange={(ability) => patch({ ability })} />
      </Field>

      <Field label="Item">
        <ItemField
          set={set}
          lookup={lookup}
          itemOptions={itemOptions}
          itemUsage={itemUsage}
          usedItems={usedItems}
          onChange={(item) => patch({ item })}
        />
      </Field>

      <Field label="Stat alignment">
        <AlignmentPicker value={set.alignment} onChange={(alignment) => patch({ alignment })} />
      </Field>

      <Field label="Moves">
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
      </Field>

      {/* SP — final stats always follow the active (mega) forme */}
      {mon && mon.spreads.length > 0 && (
        <Field label={`Meta spreads${usage?.data.synthetic ? ' (sample data)' : ''}`}>
          <SpreadChips
            named
            spreads={mon.spreads.slice(0, 3)}
            current={{ alignment: set.alignment, sp: set.sp }}
            onPick={(alignment, sp) => patch({ alignment, sp })}
          />
        </Field>
      )}
      <SPAllocator
        baseStats={active.baseStats}
        sp={set.sp}
        alignment={set.alignment}
        onChange={(sp) => patch({ sp })}
      />
    </div>
  );
}
