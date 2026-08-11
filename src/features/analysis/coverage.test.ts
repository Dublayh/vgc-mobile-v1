import { describe, expect, test } from 'vitest';
import { coverageGaps, teamCoverage, type MoveInfo } from './coverage';
import { EMPTY_SP, type ChampionsSet } from '../../engine/types';

const MOVES: Record<string, MoveInfo> = {
  Earthquake: { type: 'Ground', category: 'Physical' },
  'Dragon Claw': { type: 'Dragon', category: 'Physical' },
  Protect: { type: 'Normal', category: 'Status' },
  Moonblast: { type: 'Fairy', category: 'Special' },
};

const TYPINGS: Record<string, string[]> = {
  Garchomp: ['Dragon', 'Ground'],
  Dragonite: ['Dragon', 'Flying'],
  Whimsicott: ['Grass', 'Fairy'],
};

const set = (species: string, moves: string[]): ChampionsSet => ({
  species,
  ability: '',
  alignment: 'Serious',
  sp: { ...EMPTY_SP },
  moves: moves as ChampionsSet['moves'],
});

const getMove = (name: string) => MOVES[name];
const getTyping = (s: ChampionsSet) =>
  TYPINGS[s.species] ? { types: TYPINGS[s.species] } : undefined;

describe('teamCoverage', () => {
  test('offense tracks best multiplier per defending type, ignoring status moves', () => {
    const cov = teamCoverage([set('Garchomp', ['Earthquake', 'Protect'])], getMove, getTyping);
    expect(cov.offense.Fire).toBe(2); // Ground hits Fire SE
    expect(cov.offense.Flying).toBe(0); // Ground can't touch Flying
    expect(cov.offense.Normal).toBe(1);
    // Protect (status) contributes nothing: Normal-type offense would hit Ghost 0
    expect(cov.offense.Ghost).toBe(1); // only via... no move hits ghost SE; ground=1
  });

  test('double-dragon core stacks Ice/Dragon weaknesses', () => {
    const cov = teamCoverage(
      [set('Garchomp', ['Earthquake']), set('Dragonite', ['Dragon Claw'])],
      getMove,
      getTyping,
    );
    expect(cov.weakCount.Ice).toBe(2); // both 4x
    expect(cov.weakCount.Dragon).toBe(2);
    expect(cov.resistCount.Electric).toBe(1); // Garchomp immune counts as resist
    const gaps = coverageGaps(cov);
    expect(gaps.weakTo).toContain('Ice');
    expect(gaps.weakTo).toContain('Dragon');
    // Fairy: can't be hit SE by Ground/Dragon → uncovered offensively
    expect(gaps.uncovered).toContain('Fairy');
  });

  test('adding a Fairy attacker patches the Fairy coverage gap', () => {
    const cov = teamCoverage(
      [set('Garchomp', ['Earthquake']), set('Whimsicott', ['Moonblast'])],
      getMove,
      getTyping,
    );
    expect(coverageGaps(cov).uncovered).not.toContain('Dragon'); // Fairy hits Dragon SE
  });
});
