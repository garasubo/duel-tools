import type { TurnOrder } from '../types';
import type { CoinTossScreen } from './coinTossDetect';

export interface CoinTossDetectionState {
  opponentSelectingDetected: boolean;
  result: TurnOrder | null;
}

export const INITIAL_COIN_TOSS_STATE: CoinTossDetectionState = {
  opponentSelectingDetected: false,
  result: null,
};

export function updateCoinTossState(
  state: CoinTossDetectionState,
  screen: CoinTossScreen | null,
): CoinTossDetectionState {
  if (state.result !== null) return state;
  if (screen === null) return state;

  switch (screen) {
    case 'user-selecting':
      // コイントス勝ち: ユーザーが選択できる → 先攻
      return { ...state, result: 'first' };

    case 'opponent-selecting':
      return { ...state, opponentSelectingDetected: true };

    case 'you-are-first':
      // 相手が選択中の後に先攻 → ゆずられ先攻
      // 相手が選択中を見ずに先攻 → 先攻（coin_win_001を逃した場合）
      return { ...state, result: state.opponentSelectingDetected ? 'third' : 'first' };

    case 'you-are-second':
      return { ...state, result: 'second' };
  }
}
