import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  REQUIRED_CONSECUTIVE,
  averageConfidence,
  getRequiredConsecutive,
} from './captureTiming';
import { canvasToDataUrl } from './captureDebug';
import { updateResultScreenGate } from './resultScreenGate';
import { DEFAULT_RESULT_ROI } from './types';
import type { DetectionResult, ROI } from './types';

export type ResultCaptureLoopState = 'scanning' | 'detected' | 'waiting-clear';

export interface ResultStreakState {
  lastResult: 'win' | 'loss' | null;
  consecutiveCount: number;
  recentResults: DetectionResult[];
}

export interface ResultStreakUpdate {
  nextStreak: ResultStreakState;
  lastOcrResult: 'win' | 'loss';
  consecutiveCount: number;
  requiredConsecutiveCount: number;
  pendingResult: DetectionResult | null;
}

export interface ResultCaptureLoop {
  state: ResultCaptureLoopState;
  pendingResult: DetectionResult | null;
  lastOcrResult: 'win' | 'loss' | null;
  consecutiveCount: number;
  requiredConsecutiveCount: number;
  hasFirstCandidateFrame: boolean;
  firstCandidateFrameDataUrl: string | null;
  runOnce: () => Promise<{ hasCandidate: boolean }>;
  confirm: () => void;
  dismiss: () => void;
  reset: () => void;
  dispose: () => void;
}

interface UseResultCaptureLoopOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  detect: (canvas: HTMLCanvasElement, roi: ROI) => Promise<DetectionResult | null>;
  disposeDetector: () => void;
  autoConfirmEnabled: boolean;
  onResultDetected: (result: 'win' | 'loss') => void;
  onResultPreview?: (result: 'win' | 'loss') => void;
  onResultScreenCleared?: () => void;
}

export function advanceResultStreak(
  streak: ResultStreakState,
  result: DetectionResult,
): ResultStreakUpdate {
  const isSameResult = result.result === streak.lastResult;
  const recentResults = (isSameResult ? [...streak.recentResults, result] : [result]).slice(
    -REQUIRED_CONSECUTIVE,
  );
  const consecutiveCount = isSameResult ? streak.consecutiveCount + 1 : 1;
  const requiredConsecutiveCount = getRequiredConsecutive(result.confidence);
  const pendingResult =
    consecutiveCount >= requiredConsecutiveCount
      ? { ...result, confidence: averageConfidence(recentResults) }
      : null;

  return {
    nextStreak: {
      lastResult: result.result,
      consecutiveCount: pendingResult ? 0 : consecutiveCount,
      recentResults,
    },
    lastOcrResult: result.result,
    consecutiveCount,
    requiredConsecutiveCount,
    pendingResult,
  };
}

const EMPTY_STREAK: ResultStreakState = {
  lastResult: null,
  consecutiveCount: 0,
  recentResults: [],
};

export function useResultCaptureLoop({
  canvasRef,
  detect,
  disposeDetector,
  autoConfirmEnabled,
  onResultDetected,
  onResultPreview,
  onResultScreenCleared,
}: UseResultCaptureLoopOptions): ResultCaptureLoop {
  const [state, setState] = useState<ResultCaptureLoopState>('scanning');
  const [pendingResult, setPendingResult] = useState<DetectionResult | null>(null);
  const [lastOcrResult, setLastOcrResult] = useState<'win' | 'loss' | null>(null);
  const [consecutiveCount, setConsecutiveCount] = useState(0);
  const [requiredConsecutiveCount, setRequiredConsecutiveCount] = useState(REQUIRED_CONSECUTIVE);
  const [firstCandidateFrameDataUrl, setFirstCandidateFrameDataUrl] = useState<string | null>(null);

  const stateRef = useRef<ResultCaptureLoopState>('scanning');
  const pendingResultRef = useRef<DetectionResult | null>(null);
  const streakRef = useRef<ResultStreakState>(EMPTY_STREAK);
  const clearFrameCountRef = useRef(0);
  const hasCandidateRef = useRef(false);
  const autoConfirmEnabledRef = useRef(autoConfirmEnabled);
  const onResultDetectedRef = useRef(onResultDetected);
  const onResultPreviewRef = useRef(onResultPreview);
  const onResultScreenClearedRef = useRef(onResultScreenCleared);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    pendingResultRef.current = pendingResult;
  }, [pendingResult]);

  useEffect(() => {
    autoConfirmEnabledRef.current = autoConfirmEnabled;
  }, [autoConfirmEnabled]);

  useEffect(() => {
    onResultDetectedRef.current = onResultDetected;
  }, [onResultDetected]);

  useEffect(() => {
    onResultPreviewRef.current = onResultPreview;
  }, [onResultPreview]);

  useEffect(() => {
    onResultScreenClearedRef.current = onResultScreenCleared;
  }, [onResultScreenCleared]);

  const resetStreak = useCallback(() => {
    streakRef.current = EMPTY_STREAK;
    clearFrameCountRef.current = 0;
    hasCandidateRef.current = false;
    setLastOcrResult(null);
    setConsecutiveCount(0);
    setRequiredConsecutiveCount(REQUIRED_CONSECUTIVE);
  }, []);

  const resetCandidateFrame = useCallback(() => {
    setFirstCandidateFrameDataUrl(null);
  }, []);

  const reset = useCallback(() => {
    setPendingResult(null);
    resetStreak();
    resetCandidateFrame();
    setState('scanning');
  }, [resetCandidateFrame, resetStreak]);

  const confirm = useCallback(() => {
    const result = pendingResultRef.current;
    if (result) {
      onResultDetectedRef.current(result.result);
    }
    setPendingResult(null);
    resetStreak();
    setState('waiting-clear');
  }, [resetStreak]);

  const dismiss = useCallback(() => {
    setPendingResult(null);
    resetStreak();
    resetCandidateFrame();
    setState('scanning');
  }, [resetCandidateFrame, resetStreak]);

  const runOnce = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return { hasCandidate: hasCandidateRef.current };

    const result = await detect(canvas, DEFAULT_RESULT_ROI);

    if (stateRef.current === 'waiting-clear') {
      const gate = updateResultScreenGate(result !== null, clearFrameCountRef.current);
      clearFrameCountRef.current = gate.clearFrameCount;
      if (gate.isReadyForNextDetection) {
        const pending = pendingResultRef.current;
        if (autoConfirmEnabledRef.current && pending) {
          onResultDetectedRef.current(pending.result);
        }
        onResultScreenClearedRef.current?.();
        setPendingResult(null);
        resetStreak();
        resetCandidateFrame();
        setState('scanning');
      }
      return { hasCandidate: hasCandidateRef.current };
    }

    if (!result) {
      streakRef.current = EMPTY_STREAK;
      hasCandidateRef.current = false;
      setLastOcrResult(null);
      setConsecutiveCount(0);
      return { hasCandidate: hasCandidateRef.current };
    }

    hasCandidateRef.current = true;
    setFirstCandidateFrameDataUrl((current) => current ?? canvasToDataUrl(canvas));

    const update = advanceResultStreak(streakRef.current, result);
    streakRef.current = update.nextStreak;
    setLastOcrResult(update.lastOcrResult);
    setConsecutiveCount(update.consecutiveCount);
    setRequiredConsecutiveCount(update.requiredConsecutiveCount);

    if (update.pendingResult) {
      onResultPreviewRef.current?.(update.pendingResult.result);
      setPendingResult(update.pendingResult);
      setState('waiting-clear');
    }
    return { hasCandidate: hasCandidateRef.current };
  }, [canvasRef, detect, resetCandidateFrame, resetStreak]);

  return {
    state,
    pendingResult,
    lastOcrResult,
    consecutiveCount,
    requiredConsecutiveCount,
    hasFirstCandidateFrame: firstCandidateFrameDataUrl !== null,
    firstCandidateFrameDataUrl,
    runOnce,
    confirm,
    dismiss,
    reset,
    dispose: disposeDetector,
  };
}
