import { describe, it, expect } from 'vitest';
import { applyDraftToOverlayStats, calcWLD } from './useStats';
import type { WinLoss } from './useStats';
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

describe('applyDraftToOverlayStats', () => {
  // 確定済み: 4戦・コイン2勝2敗
  const confirmedCount = 4;
  const baseCoinToss: WinLoss = { win: 2, loss: 2, total: 4, winRate: 0.5 };

  it('入力途中がない(null)とき確定値をそのまま返す', () => {
    const result = applyDraftToOverlayStats(confirmedCount, baseCoinToss, null);
    expect(result.matchCount).toBe(4);
    expect(result.coinToss).toEqual(baseCoinToss);
  });

  it("'first'のとき試合数+1・コイン勝ち+1", () => {
    const result = applyDraftToOverlayStats(confirmedCount, baseCoinToss, 'first');
    expect(result.matchCount).toBe(5);
    expect(result.coinToss.win).toBe(3);
    expect(result.coinToss.loss).toBe(2);
    expect(result.coinToss.total).toBe(5);
    expect(result.coinToss.winRate).toBeCloseTo(3 / 5);
  });

  it("'second'のとき試合数+1・コイン負け+1", () => {
    const result = applyDraftToOverlayStats(confirmedCount, baseCoinToss, 'second');
    expect(result.matchCount).toBe(5);
    expect(result.coinToss.win).toBe(2);
    expect(result.coinToss.loss).toBe(3);
    expect(result.coinToss.total).toBe(5);
    expect(result.coinToss.winRate).toBeCloseTo(2 / 5);
  });

  it("'third'(ゆずられ先攻)もコイン負け扱いで集計される", () => {
    const result = applyDraftToOverlayStats(confirmedCount, baseCoinToss, 'third');
    expect(result.matchCount).toBe(5);
    expect(result.coinToss.win).toBe(2);
    expect(result.coinToss.loss).toBe(3);
  });
});
