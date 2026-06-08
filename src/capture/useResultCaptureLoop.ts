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

// runOnce の動作モード。状態の所有はワークフロー状態機械（captureWorkflow）側にあり、
// 呼び出し側が現在の phase に応じてモードを渡す。
//  - 'detect': VICTORY/LOSE を OCR し連続一致で候補を確定する
//  - 'gate'  : 結果画面が消えたか（次の検出に進めるか）を判定する
export type ResultScanMode = 'detect' | 'gate';

export interface ResultStreakState {
  lastResult: 'win' | 'loss' | null;
  consecutiveCount: number;
  recentResults: DetectionResult[];
  // 連続一致の途中で検出が空振り（null）したフレーム数。
  // 演出/アニメの 1 フレームで streak が崩れないよう MISS_TOLERANCE まで許容する。
  missCount: number;
}

// 連続一致の途中で許容する空振りフレーム数。これを超えると streak をリセットする。
export const MISS_TOLERANCE = 1;

export interface ResultStreakUpdate {
  nextStreak: ResultStreakState;
  lastOcrResult: 'win' | 'loss';
  consecutiveCount: number;
  requiredConsecutiveCount: number;
  pendingResult: DetectionResult | null;
}

export interface ResultCaptureLoop {
  pendingResult: DetectionResult | null;
  lastOcrResult: 'win' | 'loss' | null;
  consecutiveCount: number;
  requiredConsecutiveCount: number;
  hasFirstCandidateFrame: boolean;
  firstCandidateFrameDataUrl: string | null;
  runOnce: (mode: ResultScanMode) => Promise<{ hasCandidate: boolean }>;
  reset: () => void;
  dispose: () => void;
}

interface UseResultCaptureLoopOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  detect: (canvas: HTMLCanvasElement, roi: ROI) => Promise<DetectionResult | null>;
  disposeDetector: () => void;
  // 連続一致で候補が確定したタイミング（pending 到達）。
  onResultPreview?: (result: 'win' | 'loss') => void;
  // 'gate' モードで結果画面が消えたことを検出したタイミング。
  onResultScreenCleared?: () => void;
  detectPostDuelScreen?: (canvas: HTMLCanvasElement) => boolean;
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
      // 本物の同一結果フレームが来たら空振りカウントはリセットする。
      missCount: 0,
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
  missCount: 0,
};

// 検出が空振り（null）したときの streak 遷移。
// 進行中の streak は MISS_TOLERANCE 回まで維持し、それを超えたら EMPTY_STREAK に戻す。
export function applyMissToStreak(streak: ResultStreakState): ResultStreakState {
  if (streak.lastResult === null || streak.consecutiveCount === 0) return EMPTY_STREAK;
  const missCount = streak.missCount + 1;
  return missCount > MISS_TOLERANCE ? EMPTY_STREAK : { ...streak, missCount };
}

export function useResultCaptureLoop({
  canvasRef,
  detect,
  disposeDetector,
  onResultPreview,
  onResultScreenCleared,
  detectPostDuelScreen,
}: UseResultCaptureLoopOptions): ResultCaptureLoop {
  const [pendingResult, setPendingResult] = useState<DetectionResult | null>(null);
  const [lastOcrResult, setLastOcrResult] = useState<'win' | 'loss' | null>(null);
  const [consecutiveCount, setConsecutiveCount] = useState(0);
  const [requiredConsecutiveCount, setRequiredConsecutiveCount] = useState(REQUIRED_CONSECUTIVE);
  const [firstCandidateFrameDataUrl, setFirstCandidateFrameDataUrl] = useState<string | null>(null);

  const streakRef = useRef<ResultStreakState>(EMPTY_STREAK);
  const clearFrameCountRef = useRef(0);
  const hasCandidateRef = useRef(false);
  const onResultPreviewRef = useRef(onResultPreview);
  const onResultScreenClearedRef = useRef(onResultScreenCleared);
  const detectPostDuelScreenRef = useRef(detectPostDuelScreen);

  useEffect(() => {
    onResultPreviewRef.current = onResultPreview;
  }, [onResultPreview]);

  useEffect(() => {
    onResultScreenClearedRef.current = onResultScreenCleared;
  }, [onResultScreenCleared]);

  useEffect(() => {
    detectPostDuelScreenRef.current = detectPostDuelScreen;
  }, [detectPostDuelScreen]);

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
  }, [resetCandidateFrame, resetStreak]);

  const runOnce = useCallback(
    async (mode: ResultScanMode) => {
      const canvas = canvasRef.current;
      if (!canvas) return { hasCandidate: hasCandidateRef.current };

      const result = await detect(canvas, DEFAULT_RESULT_ROI);

      if (mode === 'gate') {
        // 結果画面が消えたことだけを通知し、確定（フォーム反映・レート待ち分岐）は
        // ワークフロー状態機械（captureWorkflow）に委ねる。
        const triggerScreenCleared = () => {
          onResultScreenClearedRef.current?.();
          setPendingResult(null);
          resetStreak();
          resetCandidateFrame();
        };

        // 輝度検出: VICTORY テキスト不在 かつ 画面が暗い → デュエル後画面と判定し即確定
        if (!result && detectPostDuelScreenRef.current?.(canvas)) {
          triggerScreenCleared();
          return { hasCandidate: hasCandidateRef.current };
        }

        // フォールバック: N フレーム連続でテキストなし
        const gate = updateResultScreenGate(result !== null, clearFrameCountRef.current);
        clearFrameCountRef.current = gate.clearFrameCount;
        if (gate.isReadyForNextDetection) {
          triggerScreenCleared();
        }
        return { hasCandidate: hasCandidateRef.current };
      }

      if (!result) {
        const next = applyMissToStreak(streakRef.current);
        streakRef.current = next;
        // 完全に崩壊したときだけ候補状態と表示をクリアする。
        // 許容中（streak 維持）は hasCandidate を true のままにして FAST 間隔を保ち、
        // lose フレームを素早く再取得できるようにする。
        if (next.consecutiveCount === 0) {
          hasCandidateRef.current = false;
          setLastOcrResult(null);
          setConsecutiveCount(0);
        }
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
      }
      return { hasCandidate: hasCandidateRef.current };
    },
    [canvasRef, detect, resetCandidateFrame, resetStreak],
  );

  return {
    pendingResult,
    lastOcrResult,
    consecutiveCount,
    requiredConsecutiveCount,
    hasFirstCandidateFrame: firstCandidateFrameDataUrl !== null,
    firstCandidateFrameDataUrl,
    runOnce,
    reset,
    dispose: disposeDetector,
  };
}
