import { describe, it, expect } from 'vitest';
import {
  applyDraftToOverlayStats,
  calcWLD,
  computeCoinToss,
  computeDeckStats,
  computeMatchupCells,
  computeOpponentDeckStats,
} from './useStats';
import type { WinLoss } from './useStats';
import type { BattleRecord, Deck } from '../types';

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

describe('computeOpponentDeckStats', () => {
  const opponentDecks: Deck[] = [
    { id: 'opp-a', name: 'デッキA' },
    { id: 'opp-b', name: 'デッキB' },
  ];

  it('相手デッキ単位でグループ化し、試合数の降順で並ぶ', () => {
    const records = [
      makeRecord({ result: 'win', turnOrder: 'first', opponentDeckId: 'opp-a' }),
      makeRecord({ result: 'loss', turnOrder: 'second', opponentDeckId: 'opp-a' }),
      makeRecord({ result: 'win', turnOrder: 'first', opponentDeckId: 'opp-a' }),
      makeRecord({ result: 'loss', turnOrder: 'second', opponentDeckId: 'opp-b' }),
    ];
    const stats = computeOpponentDeckStats(records, opponentDecks);

    expect(stats.map((s) => s.deckId)).toEqual(['opp-a', 'opp-b']);
    const a = stats[0];
    expect(a.deckName).toBe('デッキA');
    expect(a.overall).toEqual({ win: 2, loss: 1, total: 3, winRate: 2 / 3 });
    expect(a.asFirst).toEqual({ win: 2, loss: 0, total: 2, winRate: 1 });
    expect(a.asSecond).toEqual({ win: 0, loss: 1, total: 1, winRate: 0 });
  });

  it('空文字・未登録idはまとめて「不明」バケットになる', () => {
    const records = [
      makeRecord({ result: 'win', turnOrder: 'first', opponentDeckId: '' }),
      makeRecord({ result: 'loss', turnOrder: 'second', opponentDeckId: 'deleted-deck' }),
      makeRecord({ result: 'win', turnOrder: 'first', opponentDeckId: 'opp-a' }),
    ];
    const stats = computeOpponentDeckStats(records, opponentDecks);

    const unknown = stats.find((s) => s.deckId === '');
    expect(unknown).toBeDefined();
    expect(unknown!.deckName).toBe('不明');
    expect(unknown!.overall.total).toBe(2);
    expect(unknown!.overall.win).toBe(1);
    expect(unknown!.overall.loss).toBe(1);
  });

  it('「不明」は試合数が最多でも常に最下部に並ぶ', () => {
    const records = [
      // 不明: 3戦（最多）
      makeRecord({ result: 'win', turnOrder: 'first', opponentDeckId: '' }),
      makeRecord({ result: 'win', turnOrder: 'first', opponentDeckId: '' }),
      makeRecord({ result: 'loss', turnOrder: 'second', opponentDeckId: 'deleted' }),
      // opp-a: 2戦
      makeRecord({ result: 'win', turnOrder: 'first', opponentDeckId: 'opp-a' }),
      makeRecord({ result: 'loss', turnOrder: 'second', opponentDeckId: 'opp-a' }),
      // opp-b: 1戦
      makeRecord({ result: 'win', turnOrder: 'first', opponentDeckId: 'opp-b' }),
    ];
    const stats = computeOpponentDeckStats(records, opponentDecks);

    expect(stats.map((s) => s.deckId)).toEqual(['opp-a', 'opp-b', '']);
    expect(stats[stats.length - 1].deckName).toBe('不明');
  });

  it('includeGrantedFirst=trueでゆずられ先攻が先攻に含まれる', () => {
    const records = [
      makeRecord({ result: 'win', turnOrder: 'third', opponentDeckId: 'opp-a' }),
      makeRecord({ result: 'win', turnOrder: 'first', opponentDeckId: 'opp-a' }),
    ];

    const without = computeOpponentDeckStats(records, opponentDecks, false);
    expect(without[0].asFirst.total).toBe(1);

    const withGranted = computeOpponentDeckStats(records, opponentDecks, true);
    expect(withGranted[0].asFirst.total).toBe(2);
    expect(withGranted[0].asFirst.win).toBe(2);
  });

  it('対戦データが無いとき空配列を返す', () => {
    expect(computeOpponentDeckStats([], opponentDecks)).toEqual([]);
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

describe('computeCoinToss', () => {
  it('先攻のみ勝ち、ゆずられ先攻は負け扱い', () => {
    const records = [
      makeRecord({ result: 'win', turnOrder: 'first' }),
      makeRecord({ result: 'win', turnOrder: 'second' }),
      makeRecord({ result: 'loss', turnOrder: 'third' }),
    ];
    expect(computeCoinToss(records)).toEqual({
      win: 1,
      loss: 2,
      total: 3,
      winRate: 1 / 3,
    });
  });

  it('空配列のとき全て0でwinRate=0', () => {
    expect(computeCoinToss([])).toEqual({ win: 0, loss: 0, total: 0, winRate: 0 });
  });
});

describe('computeDeckStats', () => {
  const ownDecks: Deck[] = [
    { id: 'deck-a', name: 'デッキA' },
    { id: 'deck-b', name: 'デッキB' },
  ];

  it('ownDecksの順序を保ち、0件のデッキも含める', () => {
    const records = [makeRecord({ result: 'win', turnOrder: 'first', ownDeckId: 'deck-a' })];
    const stats = computeDeckStats(records, ownDecks);
    expect(stats.map((s) => s.deckName)).toEqual(['デッキA', 'デッキB']);
    expect(stats[1].overall).toEqual({ win: 0, loss: 0, total: 0, winRate: 0 });
  });

  it('includeGrantedFirst=trueでゆずられ先攻が先攻に含まれる', () => {
    const records = [
      makeRecord({ result: 'win', turnOrder: 'first', ownDeckId: 'deck-a' }),
      makeRecord({ result: 'loss', turnOrder: 'third', ownDeckId: 'deck-a' }),
    ];
    expect(computeDeckStats(records, ownDecks)[0].asFirst.total).toBe(1);
    expect(computeDeckStats(records, ownDecks, true)[0].asFirst.total).toBe(2);
  });

  it('asSecondはincludeGrantedFirstの影響を受けない', () => {
    const records = [
      makeRecord({ result: 'win', turnOrder: 'second', ownDeckId: 'deck-a' }),
      makeRecord({ result: 'loss', turnOrder: 'third', ownDeckId: 'deck-a' }),
    ];
    const without = computeDeckStats(records, ownDecks)[0].asSecond;
    const withGranted = computeDeckStats(records, ownDecks, true)[0].asSecond;
    expect(withGranted).toEqual(without);
    expect(without.total).toBe(1);
  });
});

describe('computeMatchupCells', () => {
  const ownDecks: Deck[] = [{ id: 'deck-own', name: '自分' }];
  const opponentDecks: Deck[] = [
    { id: 'deck-opp', name: '相手' },
    { id: 'deck-opp2', name: '未対戦' },
  ];

  it('対戦実績のある組み合わせだけを返す', () => {
    const records = [
      makeRecord({ result: 'win', turnOrder: 'first' }),
      makeRecord({ result: 'loss', turnOrder: 'second' }),
    ];
    const cells = computeMatchupCells(records, ownDecks, opponentDecks);
    expect(cells).toHaveLength(1);
    expect(cells[0].ownDeckId).toBe('deck-own');
    expect(cells[0].opponentDeckId).toBe('deck-opp');
    expect(cells[0].stats).toEqual(calcWLD(records));
  });

  it('未登録の相手デッキIDは含まれない', () => {
    const records = [makeRecord({ result: 'win', turnOrder: 'first', opponentDeckId: '' })];
    expect(computeMatchupCells(records, ownDecks, opponentDecks)).toEqual([]);
  });
});
