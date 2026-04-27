export const RESULT_CLEAR_FRAME_COUNT = 2;

export interface ResultScreenGateState {
  clearFrameCount: number;
  isReadyForNextDetection: boolean;
}

export function updateResultScreenGate(
  hasResultText: boolean,
  clearFrameCount: number,
  requiredClearFrames = RESULT_CLEAR_FRAME_COUNT,
): ResultScreenGateState {
  if (hasResultText) {
    return { clearFrameCount: 0, isReadyForNextDetection: false };
  }

  const nextClearFrameCount = clearFrameCount + 1;
  return {
    clearFrameCount: nextClearFrameCount,
    isReadyForNextDetection: nextClearFrameCount >= requiredClearFrames,
  };
}
