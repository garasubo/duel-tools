import { describe, expect, it } from 'vitest';
import { RESULT_CLEAR_FRAME_COUNT, updateResultScreenGate } from './resultScreenGate';

describe('updateResultScreenGate', () => {
  it('結果テキストが残っている間は次の検出を許可しない', () => {
    expect(updateResultScreenGate(true, 0)).toEqual({
      clearFrameCount: 0,
      isReadyForNextDetection: false,
    });
    expect(updateResultScreenGate(true, 1)).toEqual({
      clearFrameCount: 0,
      isReadyForNextDetection: false,
    });
  });

  it('結果なしフレームが一定回数続いた後は再検出を許可する', () => {
    // RESULT_CLEAR_FRAME_COUNT - 1 フレームではまだ許可しない
    let state = updateResultScreenGate(false, 0);
    for (let i = 1; i < RESULT_CLEAR_FRAME_COUNT - 1; i++) {
      state = updateResultScreenGate(false, state.clearFrameCount);
    }
    expect(state.isReadyForNextDetection).toBe(false);

    // RESULT_CLEAR_FRAME_COUNT フレーム目で許可
    const finalState = updateResultScreenGate(false, state.clearFrameCount);
    expect(finalState).toEqual({
      clearFrameCount: RESULT_CLEAR_FRAME_COUNT,
      isReadyForNextDetection: true,
    });
  });
});
