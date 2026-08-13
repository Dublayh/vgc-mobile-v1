import { describe, expect, test } from 'vitest';
import { auditMatchup } from './threat';
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
  alignment: 'Jolly',
  sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
  moves: ['Earthquake', 'Dragon Claw', 'Rock Slide', 'Protect'],
});

describe('auditMatchup', () => {
  test('no damaging answer = loses (Corviknight with no moves vs Garchomp)', () => {
    const corv = set({ species: 'Corviknight', ability: 'Pressure' });
    const audit = auditMatchup(corv, GARCHOMP);
    expect(audit.outgoing).toBeNull();
    expect(audit.verdict).toBe('loses');
    // Garchomp's Earthquake doesn't touch a Flying-type: best is Rock Slide/Dragon Claw
    expect(audit.incoming?.move).not.toBe('Earthquake');
  });

  test('speed comparison uses Champions stats', () => {
    const whimsi = set({
      species: 'Whimsicott',
      ability: 'Prankster',
      alignment: 'Timid',
      sp: { hp: 32, atk: 0, def: 2, spa: 0, spd: 0, spe: 32 },
      moves: ['Moonblast'],
    });
    const audit = auditMatchup(whimsi, GARCHOMP);
    // Whimsicott base 116 Spe: trunc((116+20+32)·110/100) = trunc(184.8) = 184
    expect(audit.mySpeed).toBe(184);
    expect(audit.speed).toBe('faster');
    // Moonblast is 4× into Garchomp — Whimsicott should not "lose" this audit
    expect(audit.verdict).not.toBe('loses');
  });

  test('4x-weak slower mon loses: Tyranitar audited vs Garchomp EQ', () => {
    const ttar = set({
      species: 'Tyranitar',
      ability: 'Sand Stream',
      alignment: 'Adamant',
      sp: { hp: 32, atk: 32, def: 0, spa: 0, spd: 2, spe: 0 },
      moves: ['Rock Slide'], // neutral into Garchomp, no KO threat
    });
    const audit = auditMatchup(ttar, GARCHOMP);
    expect(audit.speed).toBe('slower');
    expect(audit.incoming?.move).toBe('Earthquake');
    expect(audit.incoming!.maxPercent).toBeGreaterThan(60); // 2HKO even with doubles spread penalty
    expect(audit.verdict).toBe('loses');
  });

  test('mirror-ish matchup is not "loses" both ways', () => {
    const a = auditMatchup(GARCHOMP, GARCHOMP);
    expect(a.speed).toBe('tie');
    expect(a.verdict).not.toBe('safe'); // speed tie + mutual heavy damage = shaky at best
  });

  test('field context: Trick Room inverts acting order, Tailwind doubles speed', () => {
    const ttar = set({
      species: 'Tyranitar',
      ability: 'Sand Stream',
      alignment: 'Brave',
      sp: { hp: 32, atk: 32, def: 0, spa: 0, spd: 2, spe: 0 },
      moves: ['Rock Slide'],
    });
    const normal = auditMatchup(ttar, GARCHOMP);
    expect(normal.actsFirst).toBe(false); // 55 spe vs 154

    const tr = auditMatchup(ttar, GARCHOMP, { trickRoom: true });
    expect(tr.actsFirst).toBe(true); // slowest moves first
    expect(tr.mySpeed).toBe(normal.mySpeed); // TR changes order, not speed

    const tw = auditMatchup(ttar, GARCHOMP, { myTailwind: true });
    expect(tw.mySpeed).toBe(normal.mySpeed * 2);

    const bothTw = auditMatchup(ttar, GARCHOMP, { theirTailwind: true, trickRoom: true });
    expect(bothTw.theirSpeed).toBe(normal.theirSpeed * 2);
    expect(bothTw.actsFirst).toBe(true); // still slower under TR → still first
  });
});
