import { describe, expect, test } from 'vitest';
import { defensiveProfile, effectiveness, TYPES } from './typechart';

describe('type chart', () => {
  test('spot checks: classic matchups', () => {
    expect(effectiveness('Ground', ['Fire', 'Steel'])).toBe(4); // Heatran
    expect(effectiveness('Ice', ['Dragon', 'Ground'])).toBe(4); // Garchomp
    expect(effectiveness('Ground', ['Flying'])).toBe(0);
    expect(effectiveness('Electric', ['Ground'])).toBe(0);
    expect(effectiveness('Dragon', ['Fairy'])).toBe(0);
    expect(effectiveness('Ghost', ['Normal'])).toBe(0);
    expect(effectiveness('Fighting', ['Ghost'])).toBe(0);
    expect(effectiveness('Poison', ['Steel'])).toBe(0);
    expect(effectiveness('Fire', ['Water'])).toBe(0.5);
    expect(effectiveness('Fairy', ['Dragon', 'Dark'])).toBe(4); // Hydreigon
    expect(effectiveness('Bug', ['Psychic', 'Dark'])).toBe(4);
    expect(effectiveness('Rock', ['Fire', 'Flying'])).toBe(4); // Charizard
    expect(effectiveness('Water', ['Rock', 'Ground'])).toBe(4);
    expect(effectiveness('Grass', ['Water', 'Ground'])).toBe(4); // Gastrodon/Swampert
  });

  test('case-insensitive (dex data uses lowercase types)', () => {
    expect(effectiveness('ground', ['fire', 'steel'])).toBe(4);
  });

  test('defensive profile: Dragon/Ground (Garchomp)', () => {
    const p = defensiveProfile(['Dragon', 'Ground']);
    expect(p.Ice).toBe(4);
    expect(p.Dragon).toBe(2);
    expect(p.Fairy).toBe(2);
    expect(p.Electric).toBe(0);
    expect(p.Fire).toBe(0.5);
    expect(p.Rock).toBe(0.5);
  });

  test('every attack type has at least one non-neutral matchup', () => {
    for (const atk of TYPES) {
      const nonNeutral = TYPES.filter((def) => effectiveness(atk, [def]) !== 1);
      expect(nonNeutral.length, atk).toBeGreaterThan(0);
    }
  });

  test('known totals: number of immunities in the chart is exactly 8', () => {
    let zeros = 0;
    for (const atk of TYPES) for (const def of TYPES) if (effectiveness(atk, [def]) === 0) zeros++;
    expect(zeros).toBe(8); // Normal/Fighting→Ghost, Ghost→Normal, Ground→Flying, Electric→Ground, Poison→Steel, Psychic→Dark, Dragon→Fairy
  });
});
