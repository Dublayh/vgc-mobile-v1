import { describe, expect, test } from 'vitest';
import { setViolations, teamViolations, type LegalityContext } from './legality';
import { EMPTY_SP, type ChampionsSet, type Team } from './types';

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const ctx: LegalityContext = {
  allowedSpecies: new Set(['Garchomp', 'Incineroar']),
  megaFormes: new Map([['Garchomp', ['Garchomp-Mega']]]),
  bannedItems: new Set(['Focus Sash']),
  clauses: ['species', 'item'],
  learnsets: new Map([
    ['Garchomp', new Set(['earthquake', 'dragonclaw', 'protect'])],
    ['Incineroar', new Set(['fakeout', 'knockoff'])],
  ]),
  abilities: new Map([
    ['Garchomp', ['Sand Veil', 'Rough Skin']],
    ['Incineroar', ['Blaze', 'Intimidate']],
  ]),
  moveId: toId,
};

const chomp = (over: Partial<ChampionsSet> = {}): ChampionsSet => ({
  species: 'Garchomp',
  ability: 'Rough Skin',
  alignment: 'Jolly',
  sp: { ...EMPTY_SP },
  moves: ['Earthquake', 'Protect'],
  ...over,
});

describe('setViolations', () => {
  test('clean set has none', () => {
    expect(setViolations(chomp(), ctx)).toEqual([]);
  });

  test('species not in regulation', () => {
    const v = setViolations(chomp({ species: 'Koraidon' }), ctx);
    expect(v.some((x) => x.code === 'species-not-allowed')).toBe(true);
  });

  test('illegal mega forme', () => {
    const v = setViolations(chomp({ megaStone: 'Garchomp-Mega-Y' }), ctx);
    expect(v.some((x) => x.code === 'mega-not-allowed')).toBe(true);
    expect(setViolations(chomp({ megaStone: 'Garchomp-Mega' }), ctx)).toEqual([]);
  });

  test('wrong ability, banned item, unlearnable + duplicate moves', () => {
    const v = setViolations(
      chomp({
        ability: 'Intimidate',
        item: 'Focus Sash',
        moves: ['Fake Out', 'Earthquake', 'Earthquake'],
      }),
      ctx,
    );
    const codes = v.map((x) => x.code);
    expect(codes).toContain('ability-mismatch');
    expect(codes).toContain('item-banned');
    expect(codes).toContain('move-illegal');
    expect(codes).toContain('move-duplicate');
  });

  test('over-pool SP flagged', () => {
    const v = setViolations(chomp({ sp: { ...EMPTY_SP, hp: 32, atk: 32, def: 32 } }), ctx);
    expect(v.some((x) => x.code === 'sp-invalid')).toBe(true);
  });

  test('items outside the Champions pool are flagged (imported pastes)', () => {
    const withPool = { ...ctx, legalItems: new Set(['Life Orb', 'Lum Berry']) };
    const v = setViolations(chomp({ item: 'Choice Specs' }), withPool);
    expect(v.some((x) => x.code === 'item-illegal')).toBe(true);
    expect(setViolations(chomp({ item: 'Life Orb' }), withPool)).toEqual([]);
    // No pool provided (null/absent) → existence check is skipped.
    expect(setViolations(chomp({ item: 'Choice Specs' }), ctx)).toEqual([]);
  });
});

describe('teamViolations', () => {
  const team = (sets: ChampionsSet[]): Team => ({
    id: 't1',
    name: 'Test',
    regulation: 'm-b',
    format: 'doubles',
    sets,
  });

  test('species and item clauses, with slot attribution', () => {
    const v = teamViolations(
      team([
        chomp({ item: 'Life Orb' }),
        chomp({ item: 'Life Orb' }),
      ]),
      ctx,
    );
    const species = v.find((x) => x.code === 'species-clause');
    const item = v.find((x) => x.code === 'item-clause');
    expect(species?.slot).toBe(1);
    expect(item?.slot).toBe(1);
  });

  test('per-set violations carry their slot index', () => {
    const v = teamViolations(team([chomp(), chomp({ species: 'Koraidon' })]), ctx);
    const bad = v.find((x) => x.code === 'species-not-allowed');
    expect(bad?.slot).toBe(1);
  });
});
