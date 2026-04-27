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
    const firstClearFrame = updateResultScreenGate(false, 0);
    expect(firstClearFrame).toEqual({
      clearFrameCount: 1,
      isReadyForNextDetection: false,
    });

    expect(updateResultScreenGate(false, firstClearFrame.clearFrameCount)).toEqual({
      clearFrameCount: RESULT_CLEAR_FRAME_COUNT,
      isReadyForNextDetection: true,
    });
  });
});
