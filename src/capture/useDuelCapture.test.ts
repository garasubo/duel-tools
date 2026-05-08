import { describe, expect, it } from 'vitest';
import { getOpponentSelectingFallbackTurnOrder } from './useDuelCapture';

describe('getOpponentSelectingFallbackTurnOrder', () => {
  it('相手選択後のバッジ first はゆずられ先攻として扱う', () => {
    expect(getOpponentSelectingFallbackTurnOrder('first')).toEqual({
      order: 'third',
      source: 'in-duel-badge',
    });
  });

  it('相手選択後のバッジ second は後攻として扱う', () => {
    expect(getOpponentSelectingFallbackTurnOrder('second')).toEqual({
      order: 'second',
      source: 'in-duel-badge',
    });
  });

  it('バッジ判定に失敗したらタイムアウトの後攻に戻す', () => {
    expect(getOpponentSelectingFallbackTurnOrder(null)).toEqual({
      order: 'second',
      source: 'opponent-timeout',
    });
  });
});
