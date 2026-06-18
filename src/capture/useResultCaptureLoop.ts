import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  REQUIRED_CONSECUTIVE,
  TENTATIVE_RESCUE_WINDOW_MS,
  averageConfidence,
  getMinConfirmDurationMs,
  getRequiredConsecutive,
} from './captureTiming';
import { canvasToDataUrl } from './captureDebug';
import { captureLog } from './captureLog';
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
  // 現在の streak で最初に同一結果を観測した時刻（ms）。確定の最小経過時間判定に使う。
  // null = まだ一致なし。
  firstMatchAt: number | null;
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
  now: number = Date.now(),
): ResultStreakUpdate {
  const isSameResult = result.result === streak.lastResult;
  const recentResults = (isSameResult ? [...streak.recentResults, result] : [result]).slice(
    -REQUIRED_CONSECUTIVE,
  );
  const consecutiveCount = isSameResult ? streak.consecutiveCount + 1 : 1;
  // 同一結果が続く間は最初の一致時刻を保持。結果が変わった/初回なら今回が起点。
  const firstMatchAt = isSameResult && streak.firstMatchAt !== null ? streak.firstMatchAt : now;
  const elapsedMs = now - firstMatchAt;
  const requiredConsecutiveCount = getRequiredConsecutive(result.confidence);
  const minDurationMs = getMinConfirmDurationMs(result.confidence);
  // 確定は「連続回数 ≥ 要求回数」かつ「最小経過時間 ≥ minDurationMs」の両方を満たすとき。
  // 後者により 30fps でも演出フラッシュを誤確定しない（fps 非依存）。
  const pendingResult =
    consecutiveCount >= requiredConsecutiveCount && elapsedMs >= minDurationMs
      ? { ...result, confidence: averageConfidence(recentResults) }
      : null;

  return {
    nextStreak: {
      lastResult: result.result,
      consecutiveCount: pendingResult ? 0 : consecutiveCount,
      recentResults,
      // 本物の同一結果フレームが来たら空振りカウントはリセットする。
      missCount: 0,
      // 確定したら次に備えてウィンドウをリセット。継続中は起点を保持。
      firstMatchAt: pendingResult ? null : firstMatchAt,
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
  firstMatchAt: null,
};

// 検出が空振り（null）したときの streak 遷移。
// 進行中の streak は MISS_TOLERANCE 回まで維持し、それを超えたら EMPTY_STREAK に戻す。
export function applyMissToStreak(streak: ResultStreakState): ResultStreakState {
  if (streak.lastResult === null || streak.consecutiveCount === 0) return EMPTY_STREAK;
  const missCount = streak.missCount + 1;
  return missCount > MISS_TOLERANCE ? EMPTY_STREAK : { ...streak, missCount };
}

// 連続確定に届かなかった検出を保持しておく暫定候補。streak が崩れて破棄された後でも、
// 直後に結果画面が消えた（暗転）のを観測したら確定する「暗転救済」の対象になる。
export interface TentativeCandidate {
  result: DetectionResult; // 保持中の最良候補（最高信頼度）
  lastSeenAt: number; // 最終観測時刻（ms）
}

// 候補を観測したときに呼ぶ。より高信頼（同値含む）の候補で差し替え、観測時刻を更新する。
// 低信頼の候補が来た場合は結果は据え置き、最終観測時刻だけ更新して救済窓を延命する。
export function trackTentativeCandidate(
  current: TentativeCandidate | null,
  result: DetectionResult,
  now: number,
): TentativeCandidate {
  if (!current || result.confidence >= current.result.confidence) {
    return { result, lastSeenAt: now };
  }
  return { ...current, lastSeenAt: now };
}

// 暫定候補が救済窓を過ぎたか。過ぎていれば誤検出とみなして破棄する。
export function isTentativeExpired(
  tentative: TentativeCandidate,
  now: number,
  windowMs = TENTATIVE_RESCUE_WINDOW_MS,
): boolean {
  return now - tentative.lastSeenAt > windowMs;
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
  // 連続確定に届かなかった検出を保持し、暗転救済の対象にする。streak とは独立に生き残る。
  const tentativeRef = useRef<TentativeCandidate | null>(null);
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
    tentativeRef.current = null;
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
        const triggerScreenCleared = (via: 'dark' | 'no-text-fallback') => {
          captureLog('result-loop', `gate: screen cleared via ${via} → onResultScreenCleared`);
          onResultScreenClearedRef.current?.();
          setPendingResult(null);
          resetStreak();
          resetCandidateFrame();
        };

        // gate 中に結果テキストが見えている = 「画面がまだクリアされていない」と解釈され、
        // この間は onResultPreview を一切呼ばない。次デュエルの Victory がここで観測されると
        // フォームの勝ちが反映されない（有力仮説1）の決定的証拠になるため必ずログする。
        if (result) {
          captureLog('result-loop', 'gate: text still present, NOT emitting preview', {
            result: result.result,
            confidence: result.confidence,
          });
        }

        // 輝度検出: VICTORY テキスト不在 かつ 画面が暗い → デュエル後画面と判定し即確定
        if (!result && detectPostDuelScreenRef.current?.(canvas)) {
          triggerScreenCleared('dark');
          return { hasCandidate: hasCandidateRef.current };
        }

        // フォールバック: N フレーム連続でテキストなし
        const gate = updateResultScreenGate(result !== null, clearFrameCountRef.current);
        clearFrameCountRef.current = gate.clearFrameCount;
        if (gate.isReadyForNextDetection) {
          triggerScreenCleared('no-text-fallback');
        }
        return { hasCandidate: hasCandidateRef.current };
      }

      if (!result) {
        // 暗転救済: 直近に検出した未確定候補があり、結果画面が消えて暗転したら確定する。
        // 本物の負けはデュエル終了（暗転）が続き、演出フラッシュはデュエルが継続する（暗転
        // しない）ため、フラッシュの誤確定を再導入せずに 1 フレーム検出の取りこぼしを防ぐ。
        const tentative = tentativeRef.current;
        if (tentative) {
          const now = Date.now();
          if (isTentativeExpired(tentative, now)) {
            tentativeRef.current = null; // 救済窓を過ぎた候補は誤検出とみなして破棄
          } else if (detectPostDuelScreenRef.current?.(canvas)) {
            captureLog('result-loop', 'detect: tentative rescue (dark) → onResultPreview', {
              result: tentative.result.result,
            });
            resetStreak();
            // 確定（フォーム反映・レート待ち分岐）は gate と同じくワークフローに委譲する。
            onResultPreviewRef.current?.(tentative.result.result);
            setPendingResult(tentative.result);
            return { hasCandidate: hasCandidateRef.current };
          }
        }

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

      const now = Date.now();
      const update = advanceResultStreak(streakRef.current, result, now);
      streakRef.current = update.nextStreak;
      setLastOcrResult(update.lastOcrResult);
      setConsecutiveCount(update.consecutiveCount);
      setRequiredConsecutiveCount(update.requiredConsecutiveCount);

      captureLog('result-loop', 'detect: result text', {
        result: result.result,
        confidence: result.confidence,
        streak: `${update.consecutiveCount}/${update.requiredConsecutiveCount}`,
        pending: update.pendingResult !== null,
      });

      if (update.pendingResult) {
        // 通常確定したので保持中の暫定候補は破棄する。
        tentativeRef.current = null;
        captureLog('result-loop', 'detect: pendingResult reached → onResultPreview', {
          result: update.pendingResult.result,
        });
        onResultPreviewRef.current?.(update.pendingResult.result);
        setPendingResult(update.pendingResult);
      } else {
        // まだ確定に届かない検出は暫定候補として保持し、暗転救済の対象にする。
        tentativeRef.current = trackTentativeCandidate(tentativeRef.current, result, now);
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
