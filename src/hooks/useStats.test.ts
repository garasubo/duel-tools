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
  // 確定済み: 全体2勝2敗 / 先攻1勝1敗 / 後攻1勝1敗 / コイン2勝2敗
  const confirmedCount = 4;
  const baseStats = {
    overall: { win: 2, loss: 2, total: 4, winRate: 0.5 } as WinLoss,
    asFirst: { win: 1, loss: 1, total: 2, winRate: 0.5 } as WinLoss,
    asSecond: { win: 1, loss: 1, total: 2, winRate: 0.5 } as WinLoss,
    coinToss: { win: 2, loss: 2, total: 4, winRate: 0.5 } as WinLoss,
  };

  it('入力途中が空(null,null)のとき確定値をそのまま返す', () => {
    const result = applyDraftToOverlayStats(confirmedCount, baseStats, {
      turnOrder: null,
      result: null,
    });
    expect(result.matchCount).toBe(4);
    expect(result.overall).toEqual(baseStats.overall);
    expect(result.asFirst).toEqual(baseStats.asFirst);
    expect(result.asSecond).toEqual(baseStats.asSecond);
    expect(result.coinToss).toEqual(baseStats.coinToss);
  });

  it('コイントスのみ(先攻・勝敗未入力)は試合数とコインのみ反映', () => {
    const result = applyDraftToOverlayStats(confirmedCount, baseStats, {
      turnOrder: 'first',
      result: null,
    });
    expect(result.matchCount).toBe(5);
    expect(result.coinToss.win).toBe(3);
    expect(result.coinToss.loss).toBe(2);
    expect(result.coinToss.winRate).toBeCloseTo(3 / 5);
    // 勝敗未確定なので全体/先攻/後攻は不変
    expect(result.overall).toEqual(baseStats.overall);
    expect(result.asFirst).toEqual(baseStats.asFirst);
    expect(result.asSecond).toEqual(baseStats.asSecond);
  });

  it('先攻・勝ちのとき全体と先攻にも反映される', () => {
    const result = applyDraftToOverlayStats(confirmedCount, baseStats, {
      turnOrder: 'first',
      result: 'win',
    });
    expect(result.matchCount).toBe(5);
    expect(result.coinToss.win).toBe(3);
    expect(result.overall.win).toBe(3);
    expect(result.overall.total).toBe(5);
    expect(result.overall.winRate).toBeCloseTo(3 / 5);
    expect(result.asFirst.win).toBe(2);
    expect(result.asFirst.total).toBe(3);
    // 後攻は不変
    expect(result.asSecond).toEqual(baseStats.asSecond);
  });

  it('後攻・負けのとき全体と後攻にも反映される', () => {
    const result = applyDraftToOverlayStats(confirmedCount, baseStats, {
      turnOrder: 'second',
      result: 'loss',
    });
    expect(result.matchCount).toBe(5);
    expect(result.coinToss.loss).toBe(3);
    expect(result.overall.loss).toBe(3);
    expect(result.overall.total).toBe(5);
    expect(result.asSecond.loss).toBe(2);
    expect(result.asSecond.total).toBe(3);
    expect(result.asFirst).toEqual(baseStats.asFirst);
  });

  it('勝敗のみ(turnOrder未入力)は試合数と全体のみ反映', () => {
    const result = applyDraftToOverlayStats(confirmedCount, baseStats, {
      turnOrder: null,
      result: 'win',
    });
    expect(result.matchCount).toBe(5);
    expect(result.overall.win).toBe(3);
    expect(result.overall.total).toBe(5);
    // turnOrder 未確定なのでコイン/先攻/後攻は不変
    expect(result.coinToss).toEqual(baseStats.coinToss);
    expect(result.asFirst).toEqual(baseStats.asFirst);
    expect(result.asSecond).toEqual(baseStats.asSecond);
  });

  it('ゆずられ先攻はincludeGrantedFirst=trueで先攻に・コインは負け扱い', () => {
    const result = applyDraftToOverlayStats(
      confirmedCount,
      baseStats,
      { turnOrder: 'third', result: 'win' },
      true,
    );
    expect(result.asFirst.win).toBe(2);
    expect(result.asFirst.total).toBe(3);
    expect(result.coinToss.loss).toBe(3);
    expect(result.asSecond).toEqual(baseStats.asSecond);
  });
});
