import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { SearchSelect } from '../../app/ui/SearchSelect';
import { Sprite } from '../../app/ui/Sprite';
import type { DexLookup, DexSpecies } from '../../data/dex';
import type { UsageLookup } from '../../data/usage';
import { computeStat, computeStats } from '../../engine/stats';
import { effectiveSpeed } from '../../engine/speed';
import { EMPTY_SP, type AlignmentName } from '../../engine/types';
import { db } from '../../storage/db';

type TailwindMode = 'none' | 'mine' | 'theirs';
type Scope = 'all' | 'meta';
type Variant = 'max' | 'min';

interface Tier {
  key: string;
  label: string;
  sub: string;
  spriteId?: string;
  speed: number;
  mine: boolean;
}

const MAX_SP_SPE = { ...EMPTY_SP, spe: 32 };

interface SpeedProfile {
  min: number;
  common?: { speed: number; label: string };
  max: number;
}

function profileOf(sp: DexSpecies, usage: UsageLookup): SpeedProfile {
  const mon = usage.get(sp.name);
  const spread = mon?.spreads[0];
  return {
    min: computeStats(sp.baseStats, { ...EMPTY_SP }, 'Brave').spe,
    ...(spread
      ? {
          common: {
            speed: computeStats(sp.baseStats, spread.sp, spread.alignment as AlignmentName).spe,
            label: `${spread.sp.spe} SP ${spread.alignment}`,
          },
        }
      : {}),
    max: computeStats(sp.baseStats, MAX_SP_SPE, 'Timid').spe,
  };
}

/** Min Spe SP for `sp` to EXCEED target speed, for neutral and +Spe alignments. */
function spToOutspeed(sp: DexSpecies, target: number) {
  const solve = (alignment: AlignmentName) => {
    for (let n = 0; n <= 32; n++) {
      if (computeStat(sp.baseStats.spe, n, alignment, 'spe') > target) return n;
    }
    return null;
  };
  return { plus: solve('Timid'), neutral: solve('Serious') };
}

/** Side-by-side speed comparison with outspeed crossover numbers. */
function SpeedCompare({ lookup, usage }: { lookup: DexLookup; usage: UsageLookup }) {
  const [a, setA] = useState<DexSpecies | undefined>();
  const [b, setB] = useState<DexSpecies | undefined>();

  const options = useMemo(
    () =>
      [...lookup.species].sort((x, y) => {
        const rx = usage.get(x.name)?.rank ?? Infinity;
        const ry = usage.get(y.name)?.rank ?? Infinity;
        return rx - ry || x.name.localeCompare(y.name);
      }),
    [lookup, usage],
  );

  const picker = (value: DexSpecies | undefined, onPick: (s: DexSpecies) => void, ph: string) => (
    <SearchSelect<DexSpecies>
      value={value}
      placeholder={ph}
      options={options}
      keyOf={(s) => s.id}
      filter={(s, q) => s.name.toLowerCase().includes(q)}
      renderValue={(s) => (
        <span className="flex items-center gap-2">
          <Sprite spriteId={s.spriteId} size={24} />
          <span className="font-display font-semibold uppercase">{s.name}</span>
        </span>
      )}
      renderOption={(s) => (
        <span className="flex items-center gap-2">
          <Sprite spriteId={s.spriteId} size={24} />
          <span className="flex-1">{s.name}</span>
          <span className="stat-num text-xs text-ink-500">base {s.baseStats.spe}</span>
        </span>
      )}
      onSelect={onPick}
    />
  );

  const pa = a ? profileOf(a, usage) : null;
  const pb = b ? profileOf(b, usage) : null;

  const cell = (v: number | undefined, other: number | undefined) => (
    <span
      className={`stat-num text-sm ${
        v === undefined
          ? 'text-ink-600'
          : other !== undefined && v > other
            ? 'text-legal'
            : other !== undefined && v < other
              ? 'text-illegal'
              : 'text-ink-200'
      }`}
    >
      {v ?? '—'}
    </span>
  );

  const crossover = (from: DexSpecies, to: DexSpecies, toProfile: SpeedProfile) => {
    const lines: string[] = [];
    for (const [what, target] of [
      ['common', toProfile.common?.speed],
      ['max', toProfile.max],
    ] as const) {
      if (target === undefined) continue;
      const { plus, neutral } = spToOutspeed(from, target);
      lines.push(
        `beats ${to.name}'s ${what} (${target}): ${
          plus === null ? 'impossible' : `${plus} SP +Spe`
        }${neutral !== null ? ` · ${neutral} SP neutral` : plus !== null ? ' · not neutral' : ''}`,
      );
    }
    return lines;
  };

  return (
    <div className="chamfer flex flex-col gap-2.5 border border-ink-800 bg-ink-900 p-3">
      <div className="grid grid-cols-2 gap-2">
        {picker(a, setA, 'First mon…')}
        {picker(b, setB, 'Second mon…')}
      </div>

      {pa && pb && a && b && (
        <>
          <div className="grid grid-cols-[4rem_1fr_1fr] gap-x-2 gap-y-1 text-sm">
            <span />
            <span className="label-caps truncate">{a.name}</span>
            <span className="label-caps truncate">{b.name}</span>
            <span className="label-caps">Max</span>
            {cell(pa.max, pb.max)}
            {cell(pb.max, pa.max)}
            <span className="label-caps">Common</span>
            {cell(pa.common?.speed, pb.common?.speed)}
            {cell(pb.common?.speed, pa.common?.speed)}
            <span className="label-caps">Min</span>
            {cell(pa.min, pb.min)}
            {cell(pb.min, pa.min)}
          </div>
          {(pa.common || pb.common) && (
            <p className="text-xs text-ink-500">
              common = top ladder spread ({pa.common?.label ?? '—'} · {pb.common?.label ?? '—'})
            </p>
          )}

          <div className="flex flex-col gap-0.5 text-xs text-ink-300">
            <p className="label-caps mt-1">{a.name}</p>
            {crossover(a, b, pb).map((l) => (
              <p key={l}>{l}</p>
            ))}
            <p className="label-caps mt-1">{b.name}</p>
            {crossover(b, a, pa).map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
          <p className="text-xs text-ink-500">
            Raw speeds — Tailwind/Trick Room reasoning lives in the ladder above and Threats.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * One L50 speed ladder: my team's actual speeds vs. the regulation — EVERY
 * forme's max (or min, for Trick Room planning) speed, plus the meta's common
 * spreads where ladder data exists.
 */
export function SpeedTiers({ usage, lookup }: { usage: UsageLookup; lookup: DexLookup }) {
  const teams = useLiveQuery(() => db.teams.toArray(), []);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [tailwind, setTailwind] = useState<TailwindMode>('none');
  const [scope, setScope] = useState<Scope>('all');
  const [variant, setVariant] = useState<Variant>('max');
  const [query, setQuery] = useState('');
  const [comparing, setComparing] = useState(false);

  const team = teams?.find((t) => t.id === teamId) ?? teams?.[0];

  const tiers: Tier[] = useMemo(() => {
    const rows: Tier[] = [];

    for (const [i, set] of (team?.sets ?? []).entries()) {
      const species = lookup.getSpecies(set.megaStone ?? set.species);
      if (!species) continue;
      const spe = computeStats(species.baseStats, set.sp, set.alignment).spe;
      rows.push({
        key: `mine-${i}`,
        label: species.name,
        sub: `${set.sp.spe} SP · ${set.alignment}`,
        spriteId: species.spriteId,
        speed: effectiveSpeed(spe, { tailwind: tailwind === 'mine' }),
        mine: true,
      });
    }

    // Scope: the whole regulation (every forme), or just the meta top 25.
    const pool =
      scope === 'all'
        ? lookup.species
        : usage
            .top(25)
            .map((m) => lookup.getSpecies(m.name))
            .filter((s): s is NonNullable<typeof s> => !!s);

    for (const species of pool) {
      const mon = usage.get(species.name);
      const spread = mon?.spreads[0];
      const common = spread
        ? computeStats(species.baseStats, spread.sp, spread.alignment as AlignmentName).spe
        : undefined;
      const invested =
        variant === 'max'
          ? computeStats(species.baseStats, MAX_SP_SPE, 'Timid').spe
          : computeStats(species.baseStats, { ...EMPTY_SP }, 'Brave').spe;

      const variantLabel = variant === 'max' ? 'max speed' : 'min speed (0 SP, −Spe)';
      if (common !== undefined && common === invested) {
        // The common spread already IS the max (or min) — one merged row,
        // labeled so it's clear nothing was dropped.
        rows.push({
          key: `meta-common-${species.name}`,
          label: species.name,
          sub: `common · ${spread!.sp.spe} SP ${spread!.alignment} (= ${variant})`,
          spriteId: species.spriteId,
          speed: effectiveSpeed(common, { tailwind: tailwind === 'theirs' }),
          mine: false,
        });
      } else {
        if (common !== undefined) {
          rows.push({
            key: `meta-common-${species.name}`,
            label: species.name,
            sub: `common · ${spread!.sp.spe} SP ${spread!.alignment}`,
            spriteId: species.spriteId,
            speed: effectiveSpeed(common, { tailwind: tailwind === 'theirs' }),
            mine: false,
          });
        }
        rows.push({
          key: `meta-${variant}-${species.name}`,
          label: species.name,
          sub: variantLabel,
          spriteId: species.spriteId,
          speed: effectiveSpeed(invested, { tailwind: tailwind === 'theirs' }),
          mine: false,
        });
      }
    }

    return rows.sort((a, b) => b.speed - a.speed);
  }, [team, usage, lookup, tailwind, scope, variant]);

  const q = query.trim().toLowerCase();
  const shown = q ? tiers.filter((t) => t.mine || t.label.toLowerCase().includes(q)) : tiers;
  const maxSpeed = shown[0]?.speed ?? 1;

  const chip = (active: boolean) =>
    `chamfer-sm px-2 py-0.5 font-display text-xs font-semibold tracking-[0.1em] uppercase ${
      active ? 'bg-gold-500 text-ink-950' : 'border border-ink-700 text-ink-400'
    }`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {teams && teams.length > 1 && (
          <select
            value={team?.id ?? ''}
            onChange={(e) => setTeamId(e.target.value)}
            className="border border-ink-700 bg-ink-850 px-2 py-1 text-sm"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <button onClick={() => setScope('all')} className={chip(scope === 'all')}>
          All {lookup.species.length}
        </button>
        <button onClick={() => setScope('meta')} className={chip(scope === 'meta')}>
          Meta 25
        </button>
        <button onClick={() => setVariant('max')} className={chip(variant === 'max')}>
          Max
        </button>
        <button onClick={() => setVariant('min')} className={chip(variant === 'min')}>
          Min
        </button>
        <span className="label-caps ml-auto">TW:</span>
        {(['none', 'mine', 'theirs'] as TailwindMode[]).map((m) => (
          <button key={m} onClick={() => setTailwind(m)} className={chip(tailwind === m)}>
            {m}
          </button>
        ))}
      </div>

      <p className="text-xs text-ink-500">
        Every forme appears once at its {variant === 'max' ? 'MAX' : 'MIN'} Speed investment;
        mons with ladder data also show their common spread (merged into one row when they're
        the same speed — that's why row counts differ between Max and Min).
      </p>

      <button
        onClick={() => setComparing((v) => !v)}
        className={`label-caps self-start ${comparing ? 'text-gold-300' : 'text-gold-400'}`}
      >
        {comparing ? '▾ Compare two mons' : '▸ Compare two mons'}
      </button>
      {comparing && <SpeedCompare lookup={lookup} usage={usage} />}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Filter ${shown.length} speed tiers… (your team always shows)`}
        className="min-h-10 border border-ink-700 bg-ink-850 px-3 text-sm outline-none placeholder:text-ink-500 focus:border-gold-600"
      />

      {!team && (
        <p className="text-sm text-ink-500">No team selected — showing the ladder only.</p>
      )}

      <ul className="chamfer border border-ink-800 bg-ink-900">
        {shown.map((t) => (
          <li
            key={t.key}
            className={`flex items-center gap-2.5 border-b border-ink-800/60 px-3 py-1 ${
              t.mine ? 'bg-gold-950/60' : ''
            }`}
            style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 44px' }}
          >
            {t.spriteId && <Sprite spriteId={t.spriteId} size={28} />}
            <span className="flex-1">
              <span
                className={`font-display text-sm font-semibold tracking-wide uppercase ${
                  t.mine ? 'text-gold-300' : ''
                }`}
              >
                {t.label}
              </span>
              <span className="ml-2 text-xs text-ink-500">{t.sub}</span>
            </span>
            <span className="h-1 w-16 bg-ink-800">
              <span
                className={`block h-full ${t.mine ? 'bg-gold-500' : 'bg-ink-300'}`}
                style={{ width: `${(t.speed / maxSpeed) * 100}%` }}
              />
            </span>
            <span className="stat-num w-9 text-right text-sm">{t.speed}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
