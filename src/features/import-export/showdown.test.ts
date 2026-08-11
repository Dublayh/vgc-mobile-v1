import { describe, expect, test } from 'vitest';
import { parsePaste, serializeSet, serializeTeam } from './showdown';
import { EMPTY_SP, type ChampionsSet } from '../../engine/types';

const SHOWDOWN_PASTE = `Chompy (Garchomp) (M) @ Life Orb
Ability: Rough Skin
Level: 50
EVs: 4 HP / 252 Atk / 252 Spe
Jolly Nature
IVs: 31 Atk
- Earthquake
- Dragon Claw
- Swords Dance
- Protect

Incineroar @ Sitrus Berry
Ability: Intimidate
Careful Nature
EVs: 252 HP / 4 Atk / 252 SpD
- Fake Out
- Knock Off
- Parting Shot
- Flare Blitz`;

describe('parsePaste', () => {
  test('imports a standard Showdown paste, translating EVs → SP', () => {
    const [chomp, incin] = parsePaste(SHOWDOWN_PASTE);
    expect(chomp.species).toBe('Garchomp'); // nickname + gender stripped
    expect(chomp.item).toBe('Life Orb');
    expect(chomp.ability).toBe('Rough Skin');
    expect(chomp.alignment).toBe('Jolly');
    expect(chomp.sp).toEqual({ hp: 1, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 });
    expect(chomp.moves).toEqual(['Earthquake', 'Dragon Claw', 'Swords Dance', 'Protect']);
    expect(incin.species).toBe('Incineroar');
    expect(incin.sp).toEqual({ hp: 32, atk: 1, def: 0, spa: 0, spd: 32, spe: 0 });
  });

  test('imports mega formes as base species + megaStone', () => {
    const [s] = parsePaste('Garchomp-Mega @ Clear Amulet\nAbility: Sand Force\n- Earthquake');
    expect(s.species).toBe('Garchomp');
    expect(s.megaStone).toBe('Garchomp-Mega');
  });

  test('native SP line round-trips losslessly', () => {
    const set: ChampionsSet = {
      species: 'Gholdengo',
      ability: 'Good as Gold',
      item: 'Choice Specs',
      alignment: 'Modest',
      sp: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 },
      moves: ['Make It Rain', 'Shadow Ball', 'Trick', 'Protect'],
    };
    const [back] = parsePaste(serializeSet(set));
    expect(back).toEqual(set);
  });
});

describe('serialize', () => {
  const set: ChampionsSet = {
    species: 'Garchomp',
    megaStone: 'Garchomp-Mega',
    ability: 'Rough Skin',
    item: 'Clear Amulet',
    alignment: 'Jolly',
    sp: { hp: 1, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
    moves: ['Earthquake', 'Dragon Claw', undefined, undefined],
  };

  test('evs mode multiplies SP ×8 for calc-site interop', () => {
    const out = serializeSet(set, { spread: 'evs' });
    expect(out).toContain('EVs: 8 HP / 252 Atk / 252 Spe');
    expect(out).toContain('Garchomp-Mega @ Clear Amulet');
    expect(out).toContain('Level: 50');
  });

  test('team serialization separates sets with blank lines', () => {
    const out = serializeTeam([set, { ...set, megaStone: undefined, item: undefined }]);
    expect(out.split('\n\n')).toHaveLength(2);
    const reparsed = parsePaste(out);
    expect(reparsed).toHaveLength(2);
    expect(reparsed[1].item).toBeUndefined();
  });

  test('empty SP spread omits the spread line', () => {
    const out = serializeSet({ ...set, sp: { ...EMPTY_SP } });
    expect(out).not.toContain('SP:');
  });
});
