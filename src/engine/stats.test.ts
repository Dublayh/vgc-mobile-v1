import { describe, expect, test } from 'vitest';
import {
  computeHP,
  computeStat,
  computeStats,
  evsToNearestSP,
  spToEVs,
  validateSP,
} from './stats';
import { ALIGNMENTS, EMPTY_SP, type AlignmentName } from './types';

// Base stats used as fixtures (verified against Showdown dex data in calc.test.ts).
const GARCHOMP = { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 };

describe('Champions stat formula (level 50, IV 31)', () => {
  test('HP: Garchomp base 108, 0 SP → 183', () => {
    // floor((2·108 + 31) · 50/100) + 50 + 10 = 123 + 60
    expect(computeHP(GARCHOMP.hp, 0)).toBe(183);
  });

  test('HP: 1 SP = exactly +1', () => {
    for (let sp = 0; sp <= 32; sp++) {
      expect(computeHP(GARCHOMP.hp, sp)).toBe(183 + sp);
    }
  });

  test('Shedinja HP is always 1', () => {
    expect(computeHP(1, 0)).toBe(1);
    expect(computeHP(1, 32)).toBe(1);
  });

  test('neutral stat: Garchomp Atk 130, 0 SP → 150', () => {
    // floor((2·130 + 31) · 50/100) + 5 = 145 + 5
    expect(computeStat(GARCHOMP.atk, 0, 'Serious', 'atk')).toBe(150);
  });

  test('+alignment: Adamant Garchomp Atk 0 SP → 165, 32 SP → 197', () => {
    expect(computeStat(GARCHOMP.atk, 0, 'Adamant', 'atk')).toBe(165);
    expect(computeStat(GARCHOMP.atk, 32, 'Adamant', 'atk')).toBe(197);
  });

  test('−alignment: Modest Garchomp Atk 0 SP → 135', () => {
    expect(computeStat(GARCHOMP.atk, 0, 'Modest', 'atk')).toBe(135);
  });

  test('default mode: 1 SP = exactly +1 final stat for every alignment', () => {
    for (const alignment of Object.keys(ALIGNMENTS) as AlignmentName[]) {
      for (let sp = 0; sp < 32; sp++) {
        const at = computeStat(GARCHOMP.spe, sp, alignment, 'spe');
        const next = computeStat(GARCHOMP.spe, sp + 1, alignment, 'spe');
        expect(next, `${alignment} spe ${sp}→${sp + 1}`).toBe(at + 1);
      }
    }
  });

  test("fallback mode ('sp-before-alignment') differs — documents why mode matters", () => {
    // Adamant, 32 SP: after-mode = floor(150·1.1)+32 = 197
    //                 before-mode = floor((150+32)·1.1) = floor(200.2) = 200
    expect(computeStat(GARCHOMP.atk, 32, 'Adamant', 'atk', 'sp-before-alignment')).toBe(200);
    expect(computeStat(GARCHOMP.atk, 32, 'Adamant', 'atk', 'sp-after-alignment')).toBe(197);
  });

  test('computeStats produces the full table', () => {
    const stats = computeStats(GARCHOMP, { ...EMPTY_SP, hp: 4, atk: 32, spe: 30 }, 'Jolly');
    expect(stats).toEqual({
      hp: 187,  // 183 + 4
      atk: 182, // 145 + 5 + 32
      def: 115, // floor(221/2)=110, +5
      spa: 90,  // floor(191/2)=95, +5=100, Jolly −spa: floor(100·0.9)
      spd: 105, // floor(201/2)=100, +5
      spe: 164, // floor(235/2)=117, +5=122, ×1.1→floor(134.2)=134, +30 SP
    });
  });
});

describe('SP validation', () => {
  test('legal spread passes', () => {
    const v = validateSP({ hp: 32, atk: 32, def: 2, spa: 0, spd: 0, spe: 0 });
    expect(v.valid).toBe(true);
    expect(v.total).toBe(66);
    expect(v.remaining).toBe(0);
  });

  test('per-stat max is 32', () => {
    const v = validateSP({ ...EMPTY_SP, atk: 33 });
    expect(v.valid).toBe(false);
    expect(v.errors[0]).toMatch(/per-stat max/);
  });

  test('pool max is 66', () => {
    const v = validateSP({ hp: 32, atk: 32, def: 32, spa: 0, spd: 0, spe: 0 });
    expect(v.valid).toBe(false);
    expect(v.errors[0]).toMatch(/pool/);
  });

  test('negative and fractional SP rejected', () => {
    expect(validateSP({ ...EMPTY_SP, spe: -1 }).valid).toBe(false);
    expect(validateSP({ ...EMPTY_SP, spe: 1.5 }).valid).toBe(false);
  });
});

describe('EV ↔ SP interop (Showdown paste import/export)', () => {
  test('classic 252/252/4 maps to 32/32/1 (legal)', () => {
    const sp = evsToNearestSP({ hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 });
    expect(sp).toEqual({ hp: 1, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 });
    expect(validateSP(sp).valid).toBe(true);
  });

  test('over-pool EV spreads are trimmed to a legal 66', () => {
    // 252/252/252 would be 32/32/32 = 96 SP — must trim to ≤66.
    const sp = evsToNearestSP({ hp: 252, atk: 252, def: 252, spa: 0, spd: 0, spe: 0 });
    const v = validateSP(sp);
    expect(v.valid).toBe(true);
    expect(v.total).toBeLessThanOrEqual(66);
  });

  test('SP → EV export multiplies by 8, capped at 252', () => {
    expect(spToEVs({ hp: 1, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 })).toEqual({
      hp: 8, atk: 252, def: 0, spa: 0, spd: 0, spe: 252,
    });
  });
});
