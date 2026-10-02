/**
 * Team Completer (plan §4): builds around a locked core. Suggestions re-rank
 * automatically after each added slot because the team is a live query.
 * Two passes: the statistical shortlist paints immediately, then a chunked
 * calc audit re-orders it with evidence — against the team's worst meta
 * matchups by default, or against the mons the user asked to cover.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../../app/settings';
import { useUI } from '../../app/store';
import { Button } from '../../app/ui/Button';
import { pct } from '../../app/ui/format';
import { Panel } from '../../app/ui/Panel';
import { Sprite } from '../../app/ui/Sprite';
import { TypeBadge } from '../../app/ui/TypeBadge';
import type { DexLookup } from '../../data/dex';
import { useTournaments } from '../../data/useTournaments';
import { useUsage } from '../../data/useUsage';
import type { AuditContext } from '../../engine/threat';
import type { ChampionsSet, Team } from '../../engine/types';
import { AdviceButton } from '../analysis/AdviceButton';
import { completeTeamPrompt } from '../analysis/adviceExport';
import {
  auditSuggestion,
  suggestPartners,
  TARGET_AUDIT,
  WORST_AUDIT,
  type Suggestion,
  type ThreatRef,
} from '../analysis/completer';
import { provenTeams } from '../analysis/provenTeams';
import { VERDICT_STYLE } from '../analysis/verdictStyle';
import { rankWorstThreats, type WorstRow } from '../analysis/worstThreats';
import { SpeciesSearch } from '../dex/SpeciesSearch';
import { usageMonToSet } from '../meta/threatSet';
import { tournamentMonToSet } from '../meta/tournamentSets';
import { updateSet } from '../../storage/teams';

const SHORTLIST = 24; // statistical candidates that get calc-audited
const SHORTLIST_TARGETED = 60; // wider net when the user names what to cover
const SHOWN = 8;
const WORST_THREATS = 10;
const MAX_TARGETS = 6;

interface Audited {
  key: string;
  suggestions: Suggestion[];
  /** the auto worst-matchup list (empty when auditing user targets) */
  threats: WorstRow[];
}

export function TeamCompleter({ team, lookup }: { team: Team; lookup: DexLookup }) {
  const usage = useUsage();
  const tournaments = useTournaments();
  const { gameMode } = useSettings();
  const { completerTargets: targets, setCompleterTargets: setTargets } = useUI();
  const full = team.sets.length >= 6;
  const targeted = targets.length > 0;

  // Fingerprint the sets, not the Team object: live queries hand out fresh
  // objects on every DB write (even a rename) and the audit is expensive.
  const teamKey = useMemo(
    () => `${gameMode}|${targets.join(',')}|${JSON.stringify(team.sets)}`,
    [team.sets, gameMode, targets],
  );
  const analysis = useMemo(
    () =>
      usage && team.sets.length > 0
        ? suggestPartners(team.sets, usage, lookup, {
            limit: targeted ? SHORTLIST_TARGETED : SHORTLIST,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamKey, usage, lookup],
  );

  const [audited, setAudited] = useState<Audited | null>(null);
  const [progress, setProgress] = useState(0);
  const run = useRef(0);
  useEffect(() => {
    if (!usage || !analysis || full) return;
    const token = ++run.current;
    const cancelled = () => run.current !== token;
    setProgress(0);
    const ctx: AuditContext = {
      gameType: gameMode,
      trickRoom: analysis.archetypes.includes('Trick Room'),
      myTailwind: analysis.archetypes.includes('Tailwind'),
    };
    (async () => {
      let refs: ThreatRef[];
      let worst: WorstRow[] = [];
      if (targeted) {
        // The user's picks, at their most common set, all weighted equally.
        refs = targets.flatMap((name) => {
          const mon = usage.get(name);
          const set = mon && usageMonToSet(mon, lookup);
          return mon && set ? [{ name: mon.name, set, usage: mon.usage, weight: 1.5 }] : [];
        });
      } else {
        const rows = await rankWorstThreats(team.sets, usage, lookup, ctx, {
          top: 80,
          onProgress: (p) => setProgress(p / 2),
          cancelled,
        });
        if (!rows) return;
        worst = rows.filter((r) => r.loses + r.shaky > 0).slice(0, WORST_THREATS);
        refs = worst;
      }
      const weights = targeted ? TARGET_AUDIT : WORST_AUDIT;
      const base = targeted ? 0 : 50;
      const out: Suggestion[] = [];
      const CHUNK = 4;
      const list = analysis.suggestions;
      for (let i = 0; i < list.length; i += CHUNK) {
        if (cancelled()) return;
        for (const s of list.slice(i, i + CHUNK)) out.push(auditSuggestion(s, refs, ctx, weights));
        setProgress(base + Math.round(((i + CHUNK) / list.length) * (100 - base)));
        await new Promise((r) => setTimeout(r, 0));
      }
      if (cancelled()) return;
      // With named targets, covering them outranks everything else.
      out.sort((a, b) =>
        targeted
          ? (b.audit?.beats.length ?? 0) - (a.audit?.beats.length ?? 0) ||
            (a.audit?.losesTo.length ?? 0) - (b.audit?.losesTo.length ?? 0) ||
            b.score - a.score
          : b.score - a.score,
      );
      setAudited({ key: teamKey, suggestions: out, threats: worst });
    })();
    return () => {
      run.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamKey, usage, lookup, analysis, full]);

  const proven = useMemo(
    () => (tournaments ? provenTeams(team.sets, tournaments, lookup) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [team.sets.length, teamKey, tournaments, lookup],
  );

  if (!usage || !analysis) {
    return (
      <p className="text-sm text-ink-500">
        {usage === null
          ? 'Team completion needs usage data (npm run data:usage).'
          : 'Add at least one Pokémon first — suggestions build around your locked core.'}
      </p>
    );
  }

  const { gaps, archetypes, roles } = analysis;
  const isAudited = audited?.key === teamKey;
  const shown = (isAudited ? audited.suggestions : analysis.suggestions).slice(0, SHOWN);
  const addSet = (set: ChampionsSet) => updateSet(team.id, team.sets.length, set);
  const metaSpecies = usage.mons
    .filter((m) => !targets.includes(m.name))
    .map((m) => lookup.getSpecies(m.name))
    .filter((s): s is NonNullable<typeof s> => !!s);

  return (
    <div className="flex flex-col gap-3">
      <Panel
        title="Team read"
        aside={
          archetypes.length > 0 && (
            <span className="chamfer-sm bg-gold-950 px-1.5 py-0.5 font-display text-xs font-semibold tracking-[0.1em] uppercase text-gold-300">
              {archetypes.join(' + ')}
            </span>
          )
        }
      >
        <div className="flex flex-col gap-2 text-xs text-ink-300">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-caps">No SE hit on:</span>
            {gaps.uncovered.length ? (
              gaps.uncovered.map((t) => <TypeBadge key={t} type={t} size="sm" />)
            ) : (
              <span className="text-legal">full coverage</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-caps">Stacked weak to:</span>
            {gaps.weakTo.length ? (
              gaps.weakTo.map((t) => <TypeBadge key={t} type={t} size="sm" />)
            ) : (
              <span className="text-legal">nothing stacked</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-caps">Roles:</span>
            {roles.size ? (
              [...roles].map((r) => (
                <span key={r} className="chamfer-sm border border-ink-700 px-1.5 py-0.5 text-ink-200">
                  {r}
                </span>
              ))
            ) : (
              <span className="text-ink-500">none yet (Fake Out, speed control, redirection, Intimidate)</span>
            )}
          </div>
        </div>
      </Panel>

      {!full && (
        <Panel
          title="Cover these"
          aside={
            <span className="label-caps">
              {targeted ? `${targets.length}/${MAX_TARGETS}` : 'optional'}
            </span>
          }
        >
          {targeted && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {targets.map((name) => {
                const sp = lookup.getSpecies(name);
                return (
                  <button
                    key={name}
                    onClick={() => setTargets(targets.filter((t) => t !== name))}
                    className="chamfer-sm flex items-center gap-1.5 border border-gold-600/50 bg-gold-950 px-2 py-1 font-display text-xs font-semibold tracking-wide uppercase text-gold-300"
                    title="Remove"
                  >
                    {sp && <Sprite spriteId={sp.spriteId} size={22} />}
                    {name} ✕
                  </button>
                );
              })}
              <button onClick={() => setTargets([])} className="label-caps self-center text-ink-500">
                clear
              </button>
            </div>
          )}
          {targets.length < MAX_TARGETS && (
            <SpeciesSearch
              species={metaSpecies}
              lookup={lookup}
              usage={usage}
              placeholder="Add a Pokémon your remaining slots must handle…"
              limit={20}
              showTypes={false}
              spriteSize={28}
              listClass="max-h-40 overflow-y-auto"
              onPick={(s) => {
                const mon = usage.get(s.name);
                if (mon) setTargets([...targets, mon.name]);
              }}
            />
          )}
          <p className="mt-2 text-xs text-ink-500">
            {targeted
              ? 'Suggestions are re-ranked by how many of these each candidate beats (calc vs. its most common set), then by fit.'
              : 'Pick one or more meta mons to cover; otherwise suggestions are audited against your worst matchups.'}
          </p>
        </Panel>
      )}

      <Panel
        title={full ? 'Team is full' : `Slot ${team.sets.length + 1} suggestions`}
        aside={
          <span className="label-caps">{isAudited ? 'calc-audited' : 'evidence-ranked'}</span>
        }
      >
        {full ? (
          <p className="text-sm text-ink-500">
            All six slots are filled — review coverage above or audit threats in Meta.
          </p>
        ) : (
          <>
            {isAudited ? (
              <p className="mb-2 text-xs text-ink-500">
                {targeted
                  ? `Audited vs. your picks: ${targets.join(', ')}.`
                  : `Audited vs. your worst matchups: ${
                      audited.threats.length
                        ? audited.threats.map((t) => t.name).join(', ')
                        : 'none — nothing in the top 80 beats this core'
                    }.`}
              </p>
            ) : (
              <div className="mb-2 flex items-center gap-3">
                <span className="label-caps">Auditing vs. {targeted ? 'your picks' : 'meta'}…</span>
                <div className="h-1.5 flex-1 bg-ink-800">
                  <div className="h-full bg-gold-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <ul className="flex flex-col gap-2.5">
              {shown.map((s) => {
                const species = lookup.getSpecies(s.name);
                return (
                  <li
                    key={s.name}
                    className="flex items-start gap-2.5 border-b border-ink-800/60 pb-2.5 last:border-0 last:pb-0"
                  >
                    {species && <Sprite spriteId={species.spriteId} size={40} />}
                    <div className="flex-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-semibold tracking-wide uppercase">
                          {s.name}
                        </span>
                        <span className="flex gap-1">
                          {species?.types.map((t) => <TypeBadge key={t} type={t} size="sm" />)}
                        </span>
                        <span className="stat-num ml-auto text-ink-500">{pct(s.usage)}</span>
                      </div>
                      {targeted && s.audit && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {s.audit.verdicts.map(({ name, verdict }) => (
                            <span
                              key={name}
                              className={`chamfer-sm px-1.5 py-0.5 font-display text-[0.65rem] font-semibold tracking-[0.06em] uppercase ${VERDICT_STYLE[verdict]}`}
                              title={`${verdict} vs ${name}`}
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="mt-0.5 text-ink-400">
                        {s.evidence.length ? s.evidence.join(' · ') : 'high usage'}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      className="shrink-0 !px-2.5 !py-1"
                      onClick={() => addSet(s.set)}
                    >
                      + Add
                    </Button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>

      {proven.length > 0 && (
        <Panel title="Proven with this core" aside={<span className="label-caps">tournament top cuts</span>}>
          <ul className="flex flex-col gap-2">
            {proven.map(({ event, placement, others }) => (
              <li
                key={`${event.id}-${placement.place}`}
                className="border-b border-ink-800/60 pb-2 text-xs last:border-0 last:pb-0"
              >
                <p className="text-ink-400">
                  <span className="stat-num text-gold-300">#{placement.place}</span>{' '}
                  <span className="text-ink-200">{placement.player}</span> · {event.name}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {others.map((m, i) => {
                    const sp = lookup.getSpecies(m.species);
                    const set = full ? null : tournamentMonToSet(m, lookup);
                    return (
                      <button
                        key={i}
                        disabled={!set}
                        onClick={() => set && addSet(set)}
                        title={set ? `Add ${m.species} with this set` : m.species}
                        className="chamfer-sm flex items-center gap-1 border border-ink-700 py-0.5 pr-2 pl-0.5 text-ink-200 hover:border-gold-600 disabled:hover:border-ink-700"
                      >
                        {sp && <Sprite spriteId={sp.spriteId} size={24} />}
                        {m.species}
                        {set && <span className="text-gold-400">+</span>}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-500">
            Placements containing every locked slot. Tap a partner to add its published set
            (SP spreads aren't published — fill those in the editor).
          </p>
        </Panel>
      )}

      <AdviceButton
        onCopy={() =>
          completeTeamPrompt(
            team,
            {
              gaps,
              archetypes,
              roles,
              suggestions: shown,
              threats: isAudited ? audited.threats : undefined,
              targets: targeted ? targets : undefined,
            },
            usage,
            { regulationLabel: lookup.regulation.label, gameMode },
          )
        }
      />
    </div>
  );
}
