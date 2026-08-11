import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Icon } from '../../app/ui/Icon';
import { Panel } from '../../app/ui/Panel';
import { Sprite } from '../../app/ui/Sprite';
import type { DexLookup } from '../../data/dex';
import type { UsageLookup, UsageMon } from '../../data/usage';
import { auditMatchup, type MatchupAudit } from '../../engine/threat';
import { db } from '../../storage/db';
import { usageMonToSet } from './threatSet';

const VERDICT_STYLE: Record<MatchupAudit['verdict'], string> = {
  safe: 'bg-legal/15 text-legal',
  shaky: 'bg-warn/15 text-warn',
  loses: 'bg-illegal/15 text-illegal',
};

/** "How does my team handle X?" — X's most common set vs. every slot. */
export function ThreatAudit({ usage, lookup }: { usage: UsageLookup; lookup: DexLookup }) {
  const teams = useLiveQuery(() => db.teams.toArray(), []);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [threatName, setThreatName] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const team = teams?.find((t) => t.id === teamId) ?? teams?.[0];
  const threat: UsageMon | undefined = threatName ? usage.get(threatName) : undefined;
  const threatSet = useMemo(
    () => (threat ? usageMonToSet(threat, lookup) : null),
    [threat, lookup],
  );

  const audits = useMemo(() => {
    if (!threatSet || !team) return [];
    return team.sets.map((mine) => {
      try {
        return auditMatchup(mine, threatSet);
      } catch {
        return null;
      }
    });
  }, [threatSet, team]);

  if (!team || team.sets.length === 0) {
    return (
      <p className="py-4 text-sm text-ink-500">
        Build a team first — the audit runs a meta threat against your slots.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {teams && teams.length > 1 && (
        <select
          value={team.id}
          onChange={(e) => setTeamId(e.target.value)}
          className="self-start border border-ink-700 bg-ink-850 px-2 py-1 text-sm"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}

      {!threat ? (
        <div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pick a threat (usage-ranked)…"
            className="mb-1 min-h-11 w-full border border-ink-700 bg-ink-850 px-3 text-sm outline-none placeholder:text-ink-500 focus:border-gold-600"
          />
          <ul className="chamfer max-h-96 overflow-y-auto border border-ink-800 bg-ink-900">
            {usage.mons
              .filter((m) => !query || m.name.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 30)
              .map((m) => {
                const sp = lookup.getSpecies(m.name);
                return (
                  <li key={m.name}>
                    <button
                      onClick={() => setThreatName(m.name)}
                      className="flex w-full items-center gap-2.5 border-b border-ink-800/60 px-3 py-1.5 text-left hover:bg-ink-850"
                    >
                      <span className="stat-num w-6 text-right text-xs text-ink-500">
                        {m.rank}
                      </span>
                      {sp && <Sprite spriteId={sp.spriteId} size={32} />}
                      <span className="flex-1 font-display text-sm font-semibold tracking-wide uppercase">
                        {m.name}
                      </span>
                      <span className="stat-num text-xs text-ink-400">
                        {(m.usage * 100).toFixed(1)}%
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            {lookup.getSpecies(threat.name) && (
              <Sprite spriteId={lookup.getSpecies(threat.name)!.spriteId} size={48} />
            )}
            <div className="flex-1">
              <p className="font-display text-lg font-bold tracking-wide uppercase italic">
                {threat.name}
              </p>
              <p className="text-xs text-ink-400">
                Most common set: {threatSet?.item ?? 'no item'} · {threatSet?.alignment} ·{' '}
                {threatSet?.moves.filter(Boolean).join(' / ')}
              </p>
            </div>
            <button onClick={() => setThreatName(null)} className="label-caps text-gold-400">
              Change
            </button>
          </div>

          <Panel title={`Your team vs. ${threat.name}`}>
            <ul className="flex flex-col gap-2.5">
              {team.sets.map((mine, i) => {
                const audit = audits[i];
                const species = lookup.getSpecies(mine.megaStone ?? mine.species);
                if (!species || !audit) return null;
                return (
                  <li key={i} className="flex items-start gap-2.5 border-b border-ink-800/60 pb-2.5 last:border-0 last:pb-0">
                    <Sprite spriteId={species.spriteId} size={40} />
                    <div className="flex-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-semibold tracking-wide uppercase">
                          {species.name}
                        </span>
                        <span
                          className={`chamfer-sm px-1.5 py-0.5 font-display font-semibold tracking-[0.1em] uppercase ${VERDICT_STYLE[audit.verdict]}`}
                        >
                          {audit.verdict}
                        </span>
                        <span className="stat-num ml-auto text-ink-400">
                          {audit.mySpeed}
                          {audit.speed === 'faster' ? ' ▲' : audit.speed === 'slower' ? ' ▼' : ' ='}{' '}
                          {audit.theirSpeed}
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-ink-300">
                        <Icon name="alert" size={12} className="text-illegal" />
                        Takes{' '}
                        {audit.incoming
                          ? `${audit.incoming.maxPercent}% max from ${audit.incoming.move}`
                          : 'nothing (no damaging move)'}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-ink-300">
                        <Icon name="calc" size={12} className="text-gold-400" />
                        Deals{' '}
                        {audit.outgoing
                          ? `${audit.outgoing.maxPercent}% max with ${audit.outgoing.move}`
                          : 'nothing back'}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {threatSet && (
            <p className="text-xs text-ink-500">
              Numbers are max rolls of the threat's most common set (
              {(threat.spreads[0]?.pct ?? 0) * 100 > 0
                ? `${((threat.spreads[0]?.pct ?? 0) * 100).toFixed(0)}% spread`
                : 'top spread'}
              , doubles). Reproduce any line in Calc.
            </p>
          )}
        </>
      )}
    </div>
  );
}
