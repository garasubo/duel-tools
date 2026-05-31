import type { BattleResult } from '../types';

// キャプチャ検出結果を UI（フォーム）へ届ける単一イベントチャネル。
// turn order は turnOrderDetection(state) 経由で配布するため、ここには含めない。
export type CaptureEvent =
  | { type: 'result'; result: BattleResult }
  | { type: 'result-preview'; result: BattleResult }
  | { type: 'rating'; rating: number }
  | { type: 'rating-confirmed'; rating: number };

export type CaptureEventListener = (event: CaptureEvent) => void;
