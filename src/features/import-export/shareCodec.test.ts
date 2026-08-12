import { describe, expect, test } from 'vitest';
import { decodeTeamShare, encodeTeamShare } from './shareCodec';
import { EMPTY_SP, type Team } from '../../engine/types';

const TEAM: Team = {
  id: 'original-id',
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
      sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
      moves: ['Earthquake', 'Dragon Claw', 'Swords Dance', 'Protect'],
    },
    {
      species: 'Whimsicott',
      ability: 'Prankster',
      alignment: 'Timid',
      sp: { ...EMPTY_SP, hp: 32, spe: 32 },
      moves: ['Tailwind', 'Moonblast'],
    },
  ],
};

describe('shareCodec', () => {
  test('round-trips a team losslessly (fresh id)', async () => {
    const blob = await encodeTeamShare(TEAM);
    expect(blob).toMatch(/^[A-Za-z0-9_-]+$/); // url-safe, no padding
    const back = await decodeTeamShare(blob);
    expect(back.id).not.toBe(TEAM.id);
    expect(back.name).toBe(TEAM.name);
    expect(back.format).toBe('doubles');
    expect(back.sets).toHaveLength(2);
    expect(back.sets[0]).toEqual({ ...TEAM.sets[0] });
    expect(back.sets[1].sp).toEqual(TEAM.sets[1].sp);
    expect(back.sets[1].moves).toEqual(['Tailwind', 'Moonblast']);
  });

  test('stays comfortably URL-sized for a full team', async () => {
    const full: Team = { ...TEAM, sets: Array(6).fill(TEAM.sets[0]) };
    const blob = await encodeTeamShare(full);
    expect(blob.length).toBeLessThan(800);
  });

  test('rejects garbage and clamps hostile numbers', async () => {
    await expect(decodeTeamShare('not-a-real-blob')).rejects.toThrow();
    const tampered: Team = {
      ...TEAM,
      sets: [{ ...TEAM.sets[1], sp: { ...EMPTY_SP, atk: 999, hp: -5 } }],
    };
    const back = await decodeTeamShare(await encodeTeamShare(tampered));
    expect(back.sets[0].sp.atk).toBe(32); // clamped to legal per-stat max
    expect(back.sets[0].sp.hp).toBe(0);
  });
});
