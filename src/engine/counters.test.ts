import { describe, expect, test } from 'vitest';
import { findCounters, type CounterCandidate } from './counters';
import { EMPTY_SP, type ChampionsSet } from './types';

const set = (partial: Partial<ChampionsSet> & { species: string }): ChampionsSet => ({
  ability: '',
  alignment: 'Serious',
  sp: { ...EMPTY_SP },
  moves: [],
  ...partial,
});

// Threat: physical Garchomp
const GARCHOMP = set({
  species: 'Garchomp',
  ability: 'Rough Skin',
  alignment: 'Jolly',
  sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
  moves: ['Earthquake', 'Dragon Claw', 'Rock Slide'],
});

const candidates: CounterCandidate[] = [
  {
    name: 'Whimsicott',
    usage: 0.22,
    set: set({
      species: 'Whimsicott',
      ability: 'Prankster',
      alignment: 'Timid',
      sp: { hp: 32, atk: 0, def: 2, spa: 0, spd: 0, spe: 32 },
      moves: ['Moonblast', 'Tailwind'],
    }),
  },
  {
    name: 'Tyranitar', // slower, 4x weak to EQ answer-wise weak
    usage: 0.1,
    set: set({
      species: 'Tyranitar',
      ability: 'Sand Stream',
      alignment: 'Adamant',
      sp: { hp: 32, atk: 32, def: 0, spa: 0, spd: 2, spe: 0 },
      moves: ['Rock Slide', 'Crunch'],
    }),
  },
  {
    name: 'Garchomp', // mirror — must be excluded
    usage: 0.3,
    set: GARCHOMP,
  },
];

describe('findCounters', () => {
  test('ranks the 4x-effective faster answer first and excludes mirrors', () => {
    const ranked = findCounters(GARCHOMP, candidates);
    expect(ranked.map((r) => r.name)).not.toContain('Garchomp');
    expect(ranked[0].name).toBe('Whimsicott');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  test('every suggestion carries reproducible evidence', () => {
    const [top] = findCounters(GARCHOMP, candidates);
    expect(top.evidence.length).toBeGreaterThanOrEqual(3);
    expect(top.evidence.join(' ')).toMatch(/takes .*% max from/);
    expect(top.evidence.join(' ')).toMatch(/acts (first|second)|speed tie/);
    expect(top.audit.outgoing?.move).toBe('Moonblast');
  });

  test('limit is respected', () => {
    expect(findCounters(GARCHOMP, candidates, { limit: 1 })).toHaveLength(1);
  });
});
