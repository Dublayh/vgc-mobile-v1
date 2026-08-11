import { useLiveQuery } from 'dexie-react-hooks';
import { useUI } from '../../app/store';
import { Button } from '../../app/ui/Button';
import { EmptyState } from '../../app/ui/EmptyState';
import { Sprite } from '../../app/ui/Sprite';
import type { DexLookup } from '../../data/dex';
import { teamViolations } from '../../engine/legality';
import { db } from '../../storage/db';
import { createTeam, deleteTeam, duplicateTeam } from '../../storage/teams';

export function TeamList({ lookup }: { lookup: DexLookup }) {
  const teams = useLiveQuery(() => db.teams.toArray(), []);
  const { openTeam } = useUI();
  const ctx = lookup.legalityContext();

  if (!teams) return null;

  const newTeam = async () => {
    const team = await createTeam(lookup.regulation.id);
    openTeam(team.id);
  };

  if (teams.length === 0) {
    return (
      <EmptyState
        icon="teams"
        title="No teams yet"
        hint={`Build your first ${lookup.regulation.label} squad.`}
        action={
          <Button variant="primary" onClick={newTeam}>
            New team
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="label-caps">
          {teams.length} team{teams.length === 1 ? '' : 's'}
        </span>
        <Button variant="primary" onClick={newTeam}>
          New team
        </Button>
      </div>

      {teams.map((team) => {
        const violations = teamViolations(team, ctx);
        return (
          <div key={team.id} className="chamfer border border-ink-800 bg-ink-900">
            <button onClick={() => openTeam(team.id)} className="w-full px-3.5 pt-3 text-left">
              <span className="flex items-center justify-between">
                <span className="font-display text-lg font-bold tracking-wide uppercase">
                  {team.name}
                </span>
                <span className="flex items-center gap-2">
                  {violations.length > 0 && (
                    <span className="chamfer-sm bg-illegal/15 px-1.5 py-0.5 font-display text-xs font-semibold text-illegal">
                      {violations.length} ⚠
                    </span>
                  )}
                  <span className="label-caps">{team.format}</span>
                </span>
              </span>
              <span className="mt-2 flex min-h-10 items-center gap-1">
                {team.sets.map((s, i) => {
                  const sp = lookup.getSpecies(s.megaStone ?? s.species);
                  return sp ? <Sprite key={i} spriteId={sp.spriteId} size={40} /> : null;
                })}
                {team.sets.length === 0 && (
                  <span className="text-sm text-ink-500">Empty — tap to build</span>
                )}
              </span>
            </button>
            <div className="flex justify-end gap-1 px-2 py-1.5">
              <Button variant="ghost" onClick={() => duplicateTeam(team.id)}>
                Duplicate
              </Button>
              <Button
                variant="ghost"
                className="hover:text-illegal"
                onClick={() => {
                  if (confirm(`Delete "${team.name}"?`)) void deleteTeam(team.id);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
