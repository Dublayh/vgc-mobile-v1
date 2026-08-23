import { EMPTY_SP, type ChampionsSet, type Team } from '../engine/types';
import { db } from './db';

export const emptySet = (species: string): ChampionsSet => ({
  species,
  ability: '',
  alignment: 'Serious',
  sp: { ...EMPTY_SP },
  moves: [],
});

export async function createTeam(
  regulation: string,
  format: Team['format'] = 'doubles',
): Promise<Team> {
  const team: Team = {
    id: crypto.randomUUID(),
    name: 'New team',
    regulation,
    format,
    sets: [],
  };
  await db.teams.add(team);
  return team;
}

export async function duplicateTeam(id: string): Promise<Team | undefined> {
  const src = await db.teams.get(id);
  if (!src) return;
  const copy: Team = structuredClone(src);
  copy.id = crypto.randomUUID();
  copy.name = `${src.name} (copy)`;
  await db.teams.add(copy);
  return copy;
}

export const renameTeam = (id: string, name: string) => db.teams.update(id, { name });
export const deleteTeam = (id: string) => db.teams.delete(id);
export const putTeam = (team: Team) => db.teams.put(team);

export async function updateSet(
  teamId: string,
  slot: number,
  patch: Partial<ChampionsSet> | null,
): Promise<void> {
  const team = await db.teams.get(teamId);
  if (!team) return;
  const sets = [...team.sets];
  if (patch === null) {
    sets.splice(slot, 1); // remove the slot
  } else if (sets[slot]) {
    sets[slot] = { ...sets[slot], ...patch };
  } else if (patch.species) {
    sets[slot] = { ...emptySet(patch.species), ...patch };
  }
  await db.teams.update(teamId, { sets });
}
