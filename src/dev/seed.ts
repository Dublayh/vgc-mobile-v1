/** Dev fixture: visit any URL with ?seed to (re)create a demo team with a
 *  known id, so editor screens are directly reachable for testing/screenshots:
 *  /?seed#teams/demo-team · /?seed#teams/demo-team/0
 */
import { EMPTY_SP, type Team } from '../engine/types';
import { db } from '../storage/db';

export async function seedDemoTeam(): Promise<void> {
  const demo: Team = {
    id: 'demo-team',
    name: 'Sand core',
    regulation: 'm-b',
    format: 'doubles',
    sets: [
      {
        species: 'Garchomp',
        megaStone: 'Garchomp-Mega',
        ability: 'Rough Skin',
        item: 'Clear Amulet',
        alignment: 'Jolly',
        sp: { ...EMPTY_SP, hp: 2, atk: 32, spe: 32 },
        moves: ['Earthquake', 'Dragon Claw', 'Swords Dance', 'Protect'],
      },
      {
        species: 'Tyranitar',
        ability: 'Sand Stream',
        item: 'Assault Vest',
        alignment: 'Adamant',
        sp: { ...EMPTY_SP, hp: 32, atk: 32, spd: 2 },
        moves: ['Rock Slide', 'Knock Off', 'Low Kick', 'Ice Punch'],
      },
      {
        species: 'Excadrill',
        ability: 'Sand Rush',
        item: 'Life Orb',
        alignment: 'Adamant',
        sp: { ...EMPTY_SP, atk: 32, spe: 32, hp: 2 },
        moves: ['Iron Head', 'High Horsepower', 'Rock Slide', 'Protect'],
      },
      {
        species: 'Whimsicott',
        ability: 'Prankster',
        item: 'Covert Cloak',
        alignment: 'Timid',
        sp: { ...EMPTY_SP, hp: 32, spe: 32, def: 2 },
        moves: ['Tailwind', 'Encore', 'Moonblast', 'Helping Hand'],
      },
    ],
  };
  await db.teams.put(demo);
}
