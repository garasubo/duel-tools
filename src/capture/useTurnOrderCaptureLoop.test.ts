import { describe, expect, it } from 'vitest';
import {
  OPPONENT_SELECTING_TIMEOUT_MS,
  getOpponentSelectingFallbackTurnOrder,
} from './useTurnOrderCaptureLoop';

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

describe('turn order fallback timing', () => {
  it('相手選択検出後30秒でバッジ画像特徴量フォールバックを使う', () => {
    expect(OPPONENT_SELECTING_TIMEOUT_MS).toBe(30_000);
  });
});
