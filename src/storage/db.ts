import Dexie, { type EntityTable } from 'dexie';
import type { Team } from '../engine/types';

export const db = new Dexie('champions-tb') as Dexie & {
  teams: EntityTable<Team, 'id'>;
};

db.version(1).stores({
  teams: 'id, name, regulation, format',
});
