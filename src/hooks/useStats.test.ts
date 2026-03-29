import { describe, it, expect } from 'vitest';
import { calcWLD } from './useStats';
import type { BattleRecord } from '../types';

function makeRecord(
  overrides: Partial<BattleRecord> & Pick<BattleRecord, 'result' | 'turnOrder'>,
): BattleRecord {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ownDeckId: 'deck-own',
    opponentDeckId: 'deck-opp',
    reasonTags: [],
    memo: '',
    ...overrides,
  };
}

describe('calcWLD', () => {
  it('空配列のとき全て0でwinRate=0', () => {
    const result = calcWLD([]);
    expect(result).toEqual({ win: 0, loss: 0, total: 0, winRate: 0 });
  });

  it('全勝のときwinRate=1', () => {
    const records = [
      makeRecord({ result: 'win', turnOrder: 'first' }),
      makeRecord({ result: 'win', turnOrder: 'second' }),
    ];
    const result = calcWLD(records);
    expect(result).toEqual({ win: 2, loss: 0, total: 2, winRate: 1 });
  });

  it('全敗のときwinRate=0', () => {
    const records = [
      makeRecord({ result: 'loss', turnOrder: 'first' }),
      makeRecord({ result: 'loss', turnOrder: 'second' }),
    ];
    const result = calcWLD(records);
    expect(result).toEqual({ win: 0, loss: 2, total: 2, winRate: 0 });
  });

  it('3勝1敗のとき正しく集計される', () => {
    const records = [
      makeRecord({ result: 'win', turnOrder: 'first' }),
      makeRecord({ result: 'win', turnOrder: 'first' }),
      makeRecord({ result: 'win', turnOrder: 'second' }),
      makeRecord({ result: 'loss', turnOrder: 'second' }),
    ];
    const result = calcWLD(records);
    expect(result.win).toBe(3);
    expect(result.loss).toBe(1);
    expect(result.total).toBe(4);
    expect(result.winRate).toBeCloseTo(3 / 4);
  });
});
