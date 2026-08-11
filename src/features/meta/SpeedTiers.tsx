import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Sprite } from '../../app/ui/Sprite';
import type { DexLookup } from '../../data/dex';
import type { UsageLookup } from '../../data/usage';
import { computeStats } from '../../engine/stats';
import { effectiveSpeed } from '../../engine/speed';
import type { AlignmentName } from '../../engine/types';
import { db } from '../../storage/db';

type TailwindMode = 'none' | 'mine' | 'theirs';

interface Tier {
  key: string;
  label: string;
  sub: string;
  spriteId?: string;
  speed: number;
  mine: boolean;
}

/** One L50 speed ladder: my team's actual speeds vs. the meta's common+max speeds. */
export function SpeedTiers({ usage, lookup }: { usage: UsageLookup; lookup: DexLookup }) {
  const teams = useLiveQuery(() => db.teams.toArray(), []);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [tailwind, setTailwind] = useState<TailwindMode>('none');

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

    for (const mon of usage.top(25)) {
      const species = lookup.getSpecies(mon.name);
      if (!species) continue;
      const spread = mon.spreads[0];
      const common = spread
        ? computeStats(species.baseStats, spread.sp, spread.alignment as AlignmentName).spe
        : undefined;
      // Max: 32 SP with a +Spe alignment.
      const max = computeStats(
        species.baseStats,
        { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 32 },
        'Timid',
      ).spe;
      if (common !== undefined) {
        rows.push({
          key: `meta-common-${mon.name}`,
          label: mon.name,
          sub: `common · ${spread!.sp.spe} SP ${spread!.alignment}`,
          spriteId: species.spriteId,
          speed: effectiveSpeed(common, { tailwind: tailwind === 'theirs' }),
          mine: false,
        });
      }
      if (max !== common) {
        rows.push({
          key: `meta-max-${mon.name}`,
          label: mon.name,
          sub: 'max speed',
          spriteId: species.spriteId,
          speed: effectiveSpeed(max, { tailwind: tailwind === 'theirs' }),
          mine: false,
        });
      }
    }

    return rows.sort((a, b) => b.speed - a.speed);
  }, [team, usage, lookup, tailwind]);

  const maxSpeed = tiers[0]?.speed ?? 1;

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
        <span className="label-caps ml-auto">Tailwind:</span>
        {(['none', 'mine', 'theirs'] as TailwindMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setTailwind(m)}
            className={`chamfer-sm px-2 py-0.5 font-display text-xs font-semibold tracking-[0.1em] uppercase ${
              tailwind === m ? 'bg-gold-500 text-ink-950' : 'border border-ink-700 text-ink-400'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {!team && (
        <p className="text-sm text-ink-500">No team selected — showing the meta ladder only.</p>
      )}

      <ul className="chamfer border border-ink-800 bg-ink-900">
        {tiers.map((t) => (
          <li
            key={t.key}
            className={`flex items-center gap-2.5 border-b border-ink-800/60 px-3 py-1 ${
              t.mine ? 'bg-gold-950/60' : ''
            }`}
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
