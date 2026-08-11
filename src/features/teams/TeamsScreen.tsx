import { useLiveQuery } from 'dexie-react-hooks';
import { useUI } from '../../app/store';
import type { DexLookup } from '../../data/dex';
import { db } from '../../storage/db';
import { SetEditor } from './SetEditor';
import { TeamEditor } from './TeamEditor';
import { TeamList } from './TeamList';

export function TeamsScreen({ lookup }: { lookup: DexLookup }) {
  const { teamId, slot } = useUI();
  const team = useLiveQuery(
    () => (teamId ? db.teams.get(teamId) : undefined),
    [teamId],
  );

  if (!teamId) return <TeamList lookup={lookup} />;
  if (!team) return null; // loading, or deleted from under us
  if (slot !== null) return <SetEditor team={team} slot={slot} lookup={lookup} />;
  return <TeamEditor team={team} lookup={lookup} />;
}
