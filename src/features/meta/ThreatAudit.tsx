import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../../app/settings';
import { useUI } from '../../app/store';
import { Chip, Segmented } from '../../app/ui/Chip';
import { pct } from '../../app/ui/format';
import { Icon } from '../../app/ui/Icon';
import { Panel } from '../../app/ui/Panel';
import { Sprite } from '../../app/ui/Sprite';
import type { DexLookup } from '../../data/dex';
import type { UsageLookup, UsageMon } from '../../data/usage';
import { findCounters, type CounterCandidate } from '../../engine/counters';
import { auditMatchup, type AuditContext } from '../../engine/threat';
import type { ChampionsSet } from '../../engine/types';
import { db } from '../../storage/db';
import { AdviceButton } from '../analysis/AdviceButton';
import { threatAdvicePrompt } from '../analysis/adviceExport';
import { detectArchetypes } from '../analysis/completer';
import { VERDICT_STYLE } from '../analysis/verdictStyle';
import { rankWorstThreats, type WorstRow } from '../analysis/worstThreats';
import { useCalc } from '../calc/calcStore';
import { useJumpToCalc } from '../calc/jumpToCalc';
import { SpeciesSearch } from '../dex/SpeciesSearch';
import { usageMonToSet } from './threatSet';

export function ThreatAudit({ usage, lookup }: { usage: UsageLookup; lookup: DexLookup }) {
  const teams = useLiveQuery(() => db.teams.toArray(), []);
  // Team selection, sub-view and the chosen threat all live in the nav store
  // (shared with Speed; back button pops browse → worst).
  const {
    threatName,
    openThreat,
    threatView: view,
    setThreatView: setView,
    metaTeamId: teamId,
    setMetaTeamId: setTeamId,
  } = useUI();
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

  const { gameMode } = useSettings();
  const ctx: AuditContext = { gameType: gameMode, trickRoom, myTailwind, theirTailwind };

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
    void rankWorstThreats(team.sets, usage, lookup, ctx, {
      onProgress: setWorstProgress,
      cancelled: () => worstToken.current !== token,
    }).then((rows) => rows && setWorst(rows));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, teamKey, trickRoom, myTailwind, theirTailwind, gameMode, usage, lookup]);

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
  }, [threatSet, team, trickRoom, myTailwind, theirTailwind, gameMode]);

  if (!team || team.sets.length === 0) {
    return (
      <p className="py-4 text-sm text-ink-500">
        Build a team first — the audit runs a meta threat against your slots.
      </p>
    );
  }

  const fieldToggles = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="label-caps">Field:</span>
      <Chip active={trickRoom} onClick={() => setTrickRoom((v) => !v)}>
        Trick Room
      </Chip>
      <Chip active={myTailwind} onClick={() => setMyTailwind((v) => !v)}>
        My Tailwind
      </Chip>
      <Chip active={theirTailwind} onClick={() => setTheirTailwind((v) => !v)}>
        Their Tailwind
      </Chip>
      {autoNote && <span className="text-xs text-ink-500">auto from team plan</span>}
    </div>
  );

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
          <Segmented
            value={view}
            options={[
              { value: 'worst', label: 'Worst matchups' },
              { value: 'browse', label: 'Browse by usage' },
            ]}
            onChange={setView}
          />
          {fieldToggles}
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
                          onClick={() => openThreat(r.name)}
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
                            <span className="stat-num ml-2 text-xs text-ink-500">{pct(r.usage)}</span>
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
        <SpeciesSearch
          species={usage.mons
            .map((m) => lookup.getSpecies(m.name))
            .filter((s): s is NonNullable<typeof s> => !!s)}
          lookup={lookup}
          usage={usage}
          placeholder="Pick a threat (usage-ranked)…"
          limit={30}
          showRank
          showTypes={false}
          listClass="chamfer max-h-96 overflow-y-auto border border-ink-800 bg-ink-900"
          onPick={(s) => openThreat(s.name)}
        />
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
              <button onClick={() => openThreat(null)} className="label-caps text-gold-400">
                Change
              </button>
              <button onClick={() => jumpToCalc(threat.name)} className="label-caps text-gold-400">
                Calc vs ›
              </button>
            </div>
          </div>

          {fieldToggles}

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
              , {gameMode.toLowerCase()}). Reproduce any line in Calc.
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
                threatAdvicePrompt(team, threat.name, threatSet, audits, usage, {
                  regulationLabel: lookup.regulation.label,
                  gameMode,
                })
              }
            />
          )}
        </>
      )}
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
  const { openCalc } = useUI();
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
  }, [threatSet, usage, lookup, ctx.gameType, ctx.trickRoom, ctx.myTailwind, ctx.theirTailwind]);

  const openInCalc = (counterSet: ChampionsSet) => {
    calc.patch({
      attacker: { set: structuredClone(counterSet), sourceLabel: 'meta set', fromTeam: false },
      defender: { set: structuredClone(threatSet), sourceLabel: 'meta set', fromTeam: false },
      customMove: null,
      expandedMove: null,
    });
    openCalc('matchup');
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
                  <span className="stat-num ml-auto text-ink-500">{pct(c.usage)}</span>
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

