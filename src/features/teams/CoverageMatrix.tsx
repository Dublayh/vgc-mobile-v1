/**
 * TypeCoverageMatrix (plan §4 TeamAnalysis): one row per type —
 * offense: the team's best damaging multiplier INTO that type;
 * defense: how many members are weak to / resist attacks OF that type.
 */
import { useMemo } from 'react';
import { Panel } from '../../app/ui/Panel';
import { TypeBadge } from '../../app/ui/TypeBadge';
import type { DexLookup } from '../../data/dex';
import { TYPES } from '../../engine/typechart';
import type { Team } from '../../engine/types';
import { teamCoverage } from '../analysis/coverage';

function offenseLabel(mult: number): { text: string; cls: string } {
  if (mult >= 4) return { text: '×4', cls: 'text-legal' };
  if (mult >= 2) return { text: '×2', cls: 'text-legal' };
  if (mult >= 1) return { text: '×1', cls: 'text-ink-500' };
  if (mult > 0) return { text: '×½', cls: 'text-illegal' };
  return { text: '×0', cls: 'text-illegal' };
}

export function CoverageMatrix({ team, lookup }: { team: Team; lookup: DexLookup }) {
  const cov = useMemo(
    () =>
      teamCoverage(
        team.sets,
        (name) => lookup.getMove(name),
        (set) => lookup.getSpecies(set.megaStone ?? set.species),
      ),
    [team, lookup],
  );

  const blocks = (count: number, cls: string) =>
    Array.from({ length: count }, (_, i) => (
      <span key={i} className={`inline-block h-2.5 w-2.5 ${cls}`} />
    ));

  return (
    <Panel
      title="Type coverage"
      aside={
        <span className="label-caps">
          offense · defense ({team.sets.length} mons)
        </span>
      }
    >
      <div className="mb-1.5 flex items-center gap-2 text-[0.65rem] text-ink-500">
        <span className="flex-1">Best hit into type</span>
        <span className="inline-block h-2.5 w-2.5 bg-illegal" /> weak
        <span className="ml-1 inline-block h-2.5 w-2.5 bg-legal" /> resist
      </div>
      <ul className="flex flex-col">
        {TYPES.map((t) => {
          const off = offenseLabel(cov.offense[t]);
          const weak = cov.weakCount[t];
          const resist = cov.resistCount[t];
          const stacked = weak - resist >= 2;
          return (
            <li
              key={t}
              className={`flex items-center gap-2 border-b border-ink-800/40 py-1 last:border-0 ${
                stacked ? 'bg-illegal/5' : ''
              }`}
            >
              <TypeBadge type={t} size="sm" />
              <span className={`stat-num w-8 text-sm ${off.cls}`}>{off.text}</span>
              <span className="flex flex-1 items-center justify-end gap-0.5">
                {blocks(weak, 'bg-illegal')}
                {weak > 0 && resist > 0 && <span className="w-1" />}
                {blocks(resist, 'bg-legal')}
                {weak === 0 && resist === 0 && (
                  <span className="stat-num text-xs text-ink-600">·</span>
                )}
              </span>
              {stacked && (
                <span className="label-caps text-[0.6rem] text-illegal">stacked</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-ink-500">
        Offense counts damaging moves only. Rows tinted red are stacked weaknesses
        (2+ weak beyond your resists) — the completer targets these too.
      </p>
    </Panel>
  );
}
