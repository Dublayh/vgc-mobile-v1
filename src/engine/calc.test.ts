import { Pokemon } from '@smogon/calc';
import { describe, expect, test } from 'vitest';
import { buildField, calcSets, GEN, runCalc, toCalcPokemon } from './calc';
import { computeStats } from './stats';
import { EMPTY_SP, type ChampionsSet } from './types';

const set = (partial: Partial<ChampionsSet> & { species: string }): ChampionsSet => ({
  ability: '',
  alignment: 'Serious',
  sp: { ...EMPTY_SP },
  moves: [],
  ...partial,
});

const GARCHOMP = set({
  species: 'Garchomp',
  ability: 'Rough Skin',
  alignment: 'Adamant',
  sp: { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
  moves: ['Earthquake', 'Dragon Claw'],
});

const DONDOZO = set({
  species: 'Dondozo',
  ability: 'Oblivious', // not Unaware, to keep calcs plain
  alignment: 'Serious',
});

describe('stat injection (Approach A, clone-proof)', () => {
  const REAL_BASE = { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 };

  test('calc Pokemon carries the Champions stats, not EV-formula stats', () => {
    const p = toCalcPokemon(GARCHOMP);
    const expected = computeStats(REAL_BASE, GARCHOMP.sp, 'Adamant');
    expect(p.rawStats).toEqual(expected);
    expect(p.stats).toEqual(expected);
    expect(p.maxHP()).toBe(expected.hp); // 183
    expect(p.rawStats.atk).toBe(197);    // floor(150·1.1) + 32
    expect(p.level).toBe(50);
    // Base stats are inverted so the library's own formula lands on our values.
    expect(p.species.baseStats.atk).toBe(expected.atk - 20);
  });

  test('REGRESSION: stats survive clone() — calculate() clones its inputs', () => {
    // Post-construction rawStats mutation silently reverted to EV-formula
    // stats inside calculate(); overrides-based injection must survive.
    const p = toCalcPokemon(GARCHOMP);
    const clone = p.clone();
    expect(clone.rawStats).toEqual(p.rawStats);
    expect(clone.maxHP()).toBe(p.maxHP());
  });

  test('REGRESSION: SP investment actually changes damage through calculate()', () => {
    const zero = calcSets(
      set({ ...GARCHOMP, sp: { ...EMPTY_SP } }),
      DONDOZO,
      'Earthquake',
      { gameType: 'Singles' },
    );
    const invested = calcSets(GARCHOMP, DONDOZO, 'Earthquake', { gameType: 'Singles' });
    expect(invested.maxPercent).toBeGreaterThan(zero.maxPercent);
  });

  test('equivalence: 0 SP neutral === library level-50/IV-31/EV-0 stats', () => {
    // With no SP and a neutral alignment, Champions stats must equal what the
    // library itself computes — so injected mons behave identically in the
    // damage formula to naturally-constructed ones.
    const champ = toCalcPokemon(set({ species: 'Dragonite', ability: 'Multiscale' }));
    const natural = new Pokemon(GEN, 'Dragonite', {
      level: 50,
      nature: 'Serious',
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      evs: {},
      ability: 'Multiscale',
    });
    expect(champ.rawStats).toEqual(natural.rawStats);
  });

  test('mega forme uses mega base stats with the same SP/alignment', () => {
    const base = toCalcPokemon(GARCHOMP);
    const mega = toCalcPokemon(GARCHOMP, { formeName: 'Garchomp-Mega' });
    // Mega Garchomp: floor((340+31)/2)=185, +5=190, Adamant ×1.1=209, +32 SP
    expect(mega.rawStats.atk).toBe(241);
    expect(mega.rawStats.atk).toBeGreaterThan(base.rawStats.atk);
  });

  test('curHP percent option', () => {
    const p = toCalcPokemon(GARCHOMP, { curHPPercent: 50 });
    expect(p.curHP()).toBe(Math.floor(183 / 2));
  });
});

describe('golden damage calcs', () => {
  test('anchor: Adamant 0-SP Garchomp Earthquake vs 0-SP Dondozo (singles)', () => {
    // Hand-derived: Atk 165, Def 135, BP 100, STAB 1.5, neutral type.
    // base = floor(floor(floor(22·100·165/135)/50)+2) = floor(floor(2688/50))+2 = 55
    // rolls 85–100%: floor(55·r/100) → 46..55, STAB ×1.5 (pokeRound): 69..82
    const attacker = toCalcPokemon(set({ ...GARCHOMP, sp: { ...EMPTY_SP } }));
    const defender = toCalcPokemon(DONDOZO);
    const result = runCalc(attacker, defender, 'Earthquake', buildField({ gameType: 'Singles' }));
    expect(result.rolls.length).toBe(16);
    expect(Math.min(...result.rolls)).toBe(69);
    expect(Math.max(...result.rolls)).toBe(82);
    expect(defender.maxHP()).toBe(225);
    expect(result.koChance).toMatch(/3HKO/);
    expect(result.description).toContain('Garchomp');
  });

  test('anchor: Adamant 32-SP Garchomp (197 Atk) Earthquake vs Dondozo', () => {
    // base = floor(floor(22·100·197/135)/50)+2 = 66; rolls 85–100%: 56→84 … 66→99 (STAB)
    const result = calcSets(GARCHOMP, DONDOZO, 'Earthquake', { gameType: 'Singles' });
    expect(Math.min(...result.rolls)).toBe(84);
    expect(Math.max(...result.rolls)).toBe(99);
    // Description percentages must agree with rolls/maxHP (caught the clone bug).
    expect(result.description).toContain('37.3');
    expect(result.description).toContain('44');
    // EV wording is rewritten in Champions SP terms.
    expect(result.description).toContain('32 SP Atk');
    expect(result.description).toContain('0 SP HP');
  });

  test('doubles spread penalty: Earthquake does 0.75× into multiple targets', () => {
    const single = calcSets(GARCHOMP, DONDOZO, 'Earthquake', { gameType: 'Singles' });
    const spread = calcSets(GARCHOMP, DONDOZO, 'Earthquake', { gameType: 'Doubles' });
    expect(spread.maxPercent).toBeLessThan(single.maxPercent);
    expect(spread.maxPercent / single.maxPercent).toBeCloseTo(0.75, 1);
  });

  test('type effectiveness: Dragon Claw cannot hit Fairy', () => {
    const result = calcSets(GARCHOMP, set({ species: 'Sylveon', ability: 'Pixilate' }), 'Dragon Claw');
    expect(result.maxPercent).toBe(0);
  });

  test('items and field: Helping Hand + Life Orb raise damage', () => {
    const plain = calcSets(GARCHOMP, DONDOZO, 'Earthquake', { gameType: 'Singles' });
    const boosted = calcSets(
      { ...GARCHOMP, item: 'Life Orb' },
      DONDOZO,
      'Earthquake',
      { gameType: 'Singles', attackerSide: { isHelpingHand: true } },
    );
    expect(boosted.maxPercent).toBeGreaterThan(plain.maxPercent * 1.8);
  });

  test('new Champions mega exists in data: Mega Staraptor (Contrary)', () => {
    const p = toCalcPokemon(
      set({ species: 'Staraptor', ability: 'Contrary' }),
      { formeName: 'Staraptor-Mega' },
    );
    expect(p.species.baseStats).toMatchObject({ atk: 140, spe: 110 });
  });
});
