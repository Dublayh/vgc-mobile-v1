import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useUI } from '../../app/store';
import { Button } from '../../app/ui/Button';
import { Icon } from '../../app/ui/Icon';
import { Panel } from '../../app/ui/Panel';
import { Sprite } from '../../app/ui/Sprite';
import type { DexLookup } from '../../data/dex';
import type { UsageLookup, UsageMon } from '../../data/usage';
import { findCounters, type CounterCandidate } from '../../engine/counters';
import { auditMatchup, type AuditContext, type MatchupAudit } from '../../engine/threat';
import type { ChampionsSet } from '../../engine/types';
import { db } from '../../storage/db';
import { copyToClipboard, threatAdvicePrompt } from '../analysis/adviceExport';
import { detectArchetypes } from '../analysis/completer';
import { useCalc } from '../calc/calcStore';
import { useJumpToCalc } from '../calc/jumpToCalc';
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
  const jumpToCalc = useJumpToCalc(lookup);

  const team = teams?.find((t) => t.id === teamId) ?? teams?.[0];
  const threat: UsageMon | undefined = threatName ? usage.get(threatName) : undefined;
  const threatSet = useMemo(
    () => (threat ? usageMonToSet(threat, lookup) : null),
    [threat, lookup],
  );

  // Field toggles, auto-defaulted from the team's detected plan (TR/Tailwind).
  const archetypes = useMemo(
    () => (team ? detectArchetypes(team.sets, lookup) : []),
    [team, lookup],
  );
  const [trickRoom, setTrickRoom] = useState(false);
  const [myTailwind, setMyTailwind] = useState(false);
  const [theirTailwind, setTheirTailwind] = useState(false);
  const [autoNote, setAutoNote] = useState(false);
  useEffect(() => {
    const tr = archetypes.includes('Trick Room');
    const tw = archetypes.includes('Tailwind');
    setTrickRoom(tr);
    setMyTailwind(tw);
    setTheirTailwind(false);
    setAutoNote(tr || tw);
  }, [team?.id, archetypes]);

  const ctx: AuditContext = { trickRoom, myTailwind, theirTailwind };

  const audits = useMemo(() => {
    if (!threatSet || !team) return [];
    return team.sets.map((mine) => {
      try {
        return auditMatchup(mine, threatSet, ctx);
      } catch {
        return null;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threatSet, team, trickRoom, myTailwind, theirTailwind]);

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
            <div className="flex flex-col items-end gap-1">
              <button onClick={() => setThreatName(null)} className="label-caps text-gold-400">
                Change
              </button>
              <button onClick={() => jumpToCalc(threat.name)} className="label-caps text-gold-400">
                Calc vs ›
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-caps">Field:</span>
            <FieldToggle label="Trick Room" value={trickRoom} onChange={setTrickRoom} />
            <FieldToggle label="My Tailwind" value={myTailwind} onChange={setMyTailwind} />
            <FieldToggle label="Their Tailwind" value={theirTailwind} onChange={setTheirTailwind} />
            {autoNote && <span className="text-xs text-ink-500">auto from team plan</span>}
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
                        <span
                          className="stat-num ml-auto text-ink-400"
                          title={audit.actsFirst ? 'acts first' : 'acts second'}
                        >
                          {audit.mySpeed}
                          {audit.speed === 'tie' ? ' =' : audit.actsFirst ? ' ▲' : ' ▼'}{' '}
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

          {threatSet && (
            <CounterFinder
              threatName={threat.name}
              threatSet={threatSet}
              usage={usage}
              lookup={lookup}
              ctx={ctx}
            />
          )}

          {threatSet && (
            <AdviceButton
              onCopy={() =>
                threatAdvicePrompt(
                  team,
                  threat.name,
                  threatSet,
                  audits,
                  usage,
                )
              }
            />
          )}
        </>
      )}
    </div>
  );
}

function FieldToggle({
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

function AdviceButton({ onCopy }: { onCopy: () => string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={async () => {
          setCopied(await copyToClipboard(onCopy()));
          setTimeout(() => setCopied(false), 2200);
        }}
      >
        Ask Claude — copy prompt
      </Button>
      {copied && <span className="text-xs text-legal">Copied — paste into claude.ai</span>}
    </div>
  );
}

/** Ranked, calc-backed answers to the threat from across the meta. */
function CounterFinder({
  threatName,
  threatSet,
  usage,
  lookup,
  ctx,
}: {
  threatName: string;
  threatSet: ChampionsSet;
  usage: UsageLookup;
  lookup: DexLookup;
  ctx: AuditContext;
}) {
  const { setTab } = useUI();
  const calc = useCalc();

  const counters = useMemo(() => {
    const candidates: CounterCandidate[] = usage
      .top(80)
      .map((mon) => {
        const set = usageMonToSet(mon, lookup);
        return set ? { set, name: mon.name, usage: mon.usage } : null;
      })
      .filter((c): c is CounterCandidate => !!c);
    return findCounters(threatSet, candidates, { ...ctx, limit: 10 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threatSet, usage, lookup, ctx.trickRoom, ctx.myTailwind, ctx.theirTailwind]);

  const openInCalc = (counterSet: ChampionsSet) => {
    calc.patch({
      attacker: { set: structuredClone(counterSet), sourceLabel: 'meta set', fromTeam: false },
      defender: { set: structuredClone(threatSet), sourceLabel: 'meta set', fromTeam: false },
      customMove: null,
      expandedMove: null,
    });
    setTab('calc');
  };

  return (
    <Panel title={`Best answers to ${threatName}`} aside={<span className="label-caps">meta-wide</span>}>
      <ul className="flex flex-col gap-2">
        {counters.map((c) => {
          const species = lookup.getSpecies(c.name);
          return (
            <li
              key={c.name}
              className="flex items-start gap-2.5 border-b border-ink-800/60 pb-2 last:border-0 last:pb-0"
            >
              {species && <Sprite spriteId={species.spriteId} size={36} />}
              <div className="flex-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-semibold tracking-wide uppercase">
                    {c.name}
                  </span>
                  <span
                    className={`chamfer-sm px-1.5 py-0.5 font-display font-semibold tracking-[0.1em] uppercase ${VERDICT_STYLE[c.audit.verdict]}`}
                  >
                    {c.audit.verdict}
                  </span>
                  <span className="stat-num ml-auto text-ink-500">
                    {(c.usage * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="mt-0.5 text-[0.7rem] text-ink-500">
                  {c.set.item ? `${c.set.item} · ` : ''}
                  {c.set.alignment} · {c.set.moves.filter(Boolean).join(' / ')}
                </p>
                <p className="mt-0.5 text-ink-400">{c.evidence.join(' · ')}</p>
                <button
                  onClick={() => openInCalc(c.set)}
                  className="label-caps mt-1 text-gold-400"
                >
                  Verify in calc ›
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

