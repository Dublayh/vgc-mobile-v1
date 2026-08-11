/**
 * Team Completer (plan §4): builds around a locked core. Suggestions re-rank
 * automatically after each added slot because the team is a live query.
 */
import { useMemo, useState } from 'react';
import { Button } from '../../app/ui/Button';
import { Panel } from '../../app/ui/Panel';
import { Sprite } from '../../app/ui/Sprite';
import { TypeBadge } from '../../app/ui/TypeBadge';
import type { DexLookup } from '../../data/dex';
import { useUsage } from '../../data/useUsage';
import type { Team } from '../../engine/types';
import { completeTeamPrompt, copyToClipboard } from '../analysis/adviceExport';
import { suggestPartners } from '../analysis/completer';
import { updateSet } from '../../storage/teams';

export function TeamCompleter({ team, lookup }: { team: Team; lookup: DexLookup }) {
  const usage = useUsage();
  const [copied, setCopied] = useState(false);

  const analysis = useMemo(
    () => (usage && team.sets.length > 0 ? suggestPartners(team.sets, usage, lookup) : null),
    [team.sets, usage, lookup],
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

  const { suggestions, gaps, archetypes } = analysis;
  const full = team.sets.length >= 6;

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
        </div>
      </Panel>

      <Panel
        title={full ? 'Team is full' : `Slot ${team.sets.length + 1} suggestions`}
        aside={<span className="label-caps">evidence-ranked</span>}
      >
        {full ? (
          <p className="text-sm text-ink-500">
            All six slots are filled — review coverage above or audit threats in Meta.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {suggestions.map((s) => {
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
                      <span className="stat-num ml-auto text-ink-500">
                        {(s.usage * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="mt-0.5 text-ink-400">
                      {s.evidence.length ? s.evidence.join(' · ') : 'high usage'}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    className="shrink-0 !px-2.5 !py-1"
                    onClick={() => updateSet(team.id, team.sets.length, s.set)}
                  >
                    + Add
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="flex items-center gap-2">
        <Button
          onClick={async () => {
            setCopied(
              await copyToClipboard(
                completeTeamPrompt(team, gaps, archetypes, suggestions, usage),
              ),
            );
            setTimeout(() => setCopied(false), 2200);
          }}
        >
          Ask Claude — copy prompt
        </Button>
        {copied && <span className="text-xs text-legal">Copied — paste into claude.ai</span>}
      </div>
    </div>
  );
}
