import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
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
interface WorstRow {
  name: string;
  usage: number;
  loses: number;
  shaky: number;
  safe: number;
  score: number;
}

export function ThreatAudit({ usage, lookup }: { usage: UsageLookup; lookup: DexLookup }) {
  const teams = useLiveQuery(() => db.teams.toArray(), []);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [threatName, setThreatName] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'worst' | 'browse'>('worst');
  const [worst, setWorst] = useState<WorstRow[] | null>(null);
  const [worstProgress, setWorstProgress] = useState(0);
  const worstToken = useRef(0);
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

  // Invalidate the worst-matchup ranking whenever ANYTHING audit-relevant on
  // the team changes — species/forme, spread, alignment, item AND moves
  // (items and movesets change damage, so a partial fingerprint goes stale).
  const teamKey = useMemo(() => (team ? JSON.stringify(team.sets) : ''), [team]);
  // Compute "worst matchups": every top meta set audited vs. every team slot.
  // One effect, keyed on all inputs — a separate invalidate-effect deadlocks
  // when the archetype auto-defaults flip a field toggle right after mount.
  useEffect(() => {
    if (view !== 'worst' || !team || team.sets.length === 0) return;
    const token = ++worstToken.current;
    setWorst(null);
    setWorstProgress(0);
    (async () => {
      const threats = usage.top(100);
      const rows: WorstRow[] = [];
      const CHUNK = 5;
      for (let i = 0; i < threats.length; i += CHUNK) {
        if (worstToken.current !== token) return;
        for (const t of threats.slice(i, i + CHUNK)) {
          const tSet = usageMonToSet(t, lookup);
          if (!tSet) continue;
          let loses = 0;
          let shaky = 0;
          let safe = 0;
          for (const mine of team.sets) {
            try {
              const a = auditMatchup(mine, tSet, ctx);
              if (a.verdict === 'loses') loses++;
              else if (a.verdict === 'shaky') shaky++;
              else safe++;
            } catch {
              /* skip uncalcable slots */
            }
          }
          // Badness first, prevalence as a multiplier — a 2% mon that 4-0s you
          // matters less than Kingambit doing it.
          rows.push({
            name: t.name,
            usage: t.usage,
            loses,
            shaky,
            safe,
            score: (loses * 3 + shaky) * (0.3 + t.usage),
          });
        }
        setWorstProgress(Math.min(100, Math.round(((i + CHUNK) / threats.length) * 100)));
        await new Promise((r) => setTimeout(r, 0));
      }
      if (worstToken.current !== token) return;
      rows.sort((a, b) => b.score - a.score);
      setWorst(rows);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, teamKey, trickRoom, myTailwind, theirTailwind, usage, lookup]);

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

      {!threat && (
        <>
          <div className="flex gap-1.5">
            <FieldToggle
              label="Worst matchups"
              value={view === 'worst'}
              onChange={() => setView('worst')}
            />
            <FieldToggle
              label="Browse by usage"
              value={view === 'browse'}
              onChange={() => setView('browse')}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-caps">Field:</span>
            <FieldToggle label="Trick Room" value={trickRoom} onChange={setTrickRoom} />
            <FieldToggle label="My Tailwind" value={myTailwind} onChange={setMyTailwind} />
            <FieldToggle label="Their Tailwind" value={theirTailwind} onChange={setTheirTailwind} />
            {autoNote && <span className="text-xs text-ink-500">auto from team plan</span>}
          </div>
        </>
      )}

      {!threat && view === 'worst' && (
        <div>
          {worst === null ? (
            <div className="flex items-center gap-3 py-2">
              <span className="label-caps">Auditing meta vs. {team.name}…</span>
              <div className="h-1.5 flex-1 bg-ink-800">
                <div className="h-full bg-gold-500" style={{ width: `${worstProgress}%` }} />
              </div>
            </div>
          ) : (
            <>
              <ul className="chamfer border border-ink-800 bg-ink-900">
                {worst
                  .filter((r) => r.loses + r.shaky > 0)
                  .slice(0, 40)
                  .map((r, i) => {
                    const sp = lookup.getSpecies(r.name);
                    return (
                      <li key={r.name}>
                        <button
                          onClick={() => setThreatName(r.name)}
                          className="flex w-full items-center gap-2.5 border-b border-ink-800/60 px-3 py-1.5 text-left hover:bg-ink-850"
                        >
                          <span className="stat-num w-5 text-right text-xs text-ink-500">
                            {i + 1}
                          </span>
                          {sp && <Sprite spriteId={sp.spriteId} size={32} />}
                          <span className="flex-1">
                            <span className="font-display text-sm font-semibold tracking-wide uppercase">
                              {r.name}
                            </span>
                            <span className="stat-num ml-2 text-xs text-ink-500">
                              {(r.usage * 100).toFixed(1)}%
                            </span>
                          </span>
                          {r.loses > 0 && (
                            <span className="chamfer-sm bg-illegal/15 px-1.5 py-0.5 font-display text-xs font-semibold text-illegal">
                              {r.loses} lose
                            </span>
                          )}
                          {r.shaky > 0 && (
                            <span className="chamfer-sm bg-warn/15 px-1.5 py-0.5 font-display text-xs font-semibold text-warn">
                              {r.shaky} shaky
                            </span>
                          )}
                          {r.safe > 0 && (
                            <span className="chamfer-sm bg-legal/15 px-1.5 py-0.5 font-display text-xs font-semibold text-legal">
                              {r.safe} safe
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                {worst.every((r) => r.loses + r.shaky === 0) && (
                  <li className="px-3 py-4 text-sm text-legal">
                    Nothing in the top 100 wins a single audited matchup into this team.
                  </li>
                )}
              </ul>
              <p className="mt-1.5 text-xs text-ink-500">
                Top 100 meta sets vs. every slot, ranked by losses (weighted by usage).
                Recomputes when you edit the team or flip field toggles. Tap a row
                for the full audit + counters.
              </p>
            </>
          )}
        </div>
      )}

      {!threat && view === 'browse' && (
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
      )}

      {threat && (
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

