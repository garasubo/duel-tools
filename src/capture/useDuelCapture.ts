import { useCallback, useEffect, useRef, useState } from 'react';
import { getSampleIntervalForFps } from './captureTiming';
import {
  canvasToDataUrl,
  createCaptureFilename,
  downloadDataUrl,
  getCaptureDebugEnabled,
} from './captureDebug';
import { captureLog } from './captureLog';
import { recordTick, resetProfile, setProfilerEnabled } from './captureProfiler';
import { detectRatingFromScreen, createRatingOcrWorker } from './ratingDetect';
import { detectDpFromScreen, createDpOcrWorker } from './dpDetect';
import { isPostDuelDark } from './postDuelDetect';
import type { DuelCaptureState } from './types';
import type { CaptureEvent } from './captureEvents';
import {
  INITIAL_CAPTURE_WORKFLOW_STATE,
  captureWorkflowReducer,
} from './captureWorkflow';
import type { CaptureWorkflowEvent, CaptureWorkflowState } from './captureWorkflow';
import { useAutoConfirmSetting } from './useAutoConfirmSetting';
import { useCaptureFpsSetting } from './useCaptureFpsSetting';
import { useCaptureFrame } from './useCaptureFrame';
import { useOcrDetector } from './useOcrDetector';
import { useRatingCaptureLoop } from './useRatingCaptureLoop';
import { useResultCaptureLoop } from './useResultCaptureLoop';
import { useScreenCapture } from './useScreenCapture';
import { useTurnOrderCaptureLoop } from './useTurnOrderCaptureLoop';
export { getOpponentSelectingFallbackTurnOrder } from './useTurnOrderCaptureLoop';

function mapWorkflowPhaseToCaptureState(
  phase: CaptureWorkflowState['phase'],
): DuelCaptureState {
  switch (phase) {
    case 'idle':
      return 'idle';
    case 'scanning':
      return 'capturing';
    case 'result-detected':
      return 'detected';
    case 'waiting-clear':
      return 'waiting-clear';
    case 'waiting-rating':
      return 'waiting-rating';
    case 'waiting-dp':
      return 'waiting-dp';
  }
}

export function useDuelCapture(emit: (event: CaptureEvent) => void) {
  const { videoRef, isCapturing, error, startCapture, stopCapture } = useScreenCapture();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { captureCurrentFrame } = useCaptureFrame(videoRef, canvasRef);
  const { detect, dispose } = useOcrDetector();

  const { autoConfirmEnabled, setAutoConfirmEnabled } = useAutoConfirmSetting();

  // 結果判定ループのサンプリング頻度（fps）。キャプチャ中に変更しても次ティックから
  // 効くよう、間隔を ref に持たせて scheduleNextOcr から読む。
  const { captureFps, setCaptureFps } = useCaptureFpsSetting();
  const sampleIntervalRef = useRef(getSampleIntervalForFps(captureFps));
  useEffect(() => {
    sampleIntervalRef.current = getSampleIntervalForFps(captureFps);
  }, [captureFps]);

  const emitRef = useRef(emit);
  useEffect(() => {
    emitRef.current = emit;
  }, [emit]);

  // 結果確定後に開始するスコア検出（'rating'=レート戦 / 'dp'=DCモード / null=なし）。
  // 対戦モードに応じて BattleForm から注入される。
  const postResultScanRef = useRef<'rating' | 'dp' | null>(null);

  const setPostResultScanMode = useCallback((mode: 'rating' | 'dp' | null) => {
    postResultScanRef.current = mode;
  }, []);

  const autoConfirmEnabledRef = useRef(autoConfirmEnabled);
  useEffect(() => {
    autoConfirmEnabledRef.current = autoConfirmEnabled;
  }, [autoConfirmEnabled]);

  const handleRatingDetected = useCallback((rating: number) => {
    emitRef.current({ type: 'rating', rating });
    if (autoConfirmEnabledRef.current) {
      emitRef.current({ type: 'rating-confirmed', rating });
    }
  }, []);

  const handleDpDetected = useCallback((dp: number) => {
    emitRef.current({ type: 'dp', dp });
    if (autoConfirmEnabledRef.current) {
      emitRef.current({ type: 'dp-confirmed', dp });
    }
  }, []);

  const ratingCapture = useRatingCaptureLoop({
    canvasRef,
    onRatingDetected: handleRatingDetected,
  });

  // DP 検出ループ。汎用ループ（useRatingCaptureLoop）を DP 用 deps で再利用する。
  // 出力の ratingDetection.rating / ratingFrameDataUrl はそのまま DP 値・DP 画像として扱う。
  const dpCapture = useRatingCaptureLoop({
    canvasRef,
    onRatingDetected: handleDpDetected,
    dependencies: { createWorker: createDpOcrWorker, detectRating: detectDpFromScreen },
  });

  // --- ワークフロー状態機械（captureWorkflow）---
  // captureState の単一の source of truth。検出ループはイベントを dispatch するだけで、
  // 確定（フォーム反映）・レートループ開始といった副作用は reducer の effect として中央化する。
  const [workflowState, setWorkflowState] = useState<CaptureWorkflowState>(
    INITIAL_CAPTURE_WORKFLOW_STATE,
  );
  const workflowStateRef = useRef(workflowState);
  useEffect(() => {
    workflowStateRef.current = workflowState;
  }, [workflowState]);

  const dispatchWorkflow = useCallback(
    (event: CaptureWorkflowEvent) => {
      const fromPhase = workflowStateRef.current.phase;
      const { state, effects } = captureWorkflowReducer(workflowStateRef.current, event, {
        postResultScan: postResultScanRef.current,
      });
      captureLog('workflow', `${event.type}  ${fromPhase} → ${state.phase}`, {
        effects: effects.map((e) => e.type),
      });
      workflowStateRef.current = state;
      setWorkflowState(state);
      for (const effect of effects) {
        if (effect.type === 'commit-result') {
          emitRef.current({ type: 'result', result: effect.result });
        } else if (effect.type === 'start-rating-loop') {
          ratingCapture.start();
        } else if (effect.type === 'start-dp-loop') {
          dpCapture.start();
        }
      }
    },
    [ratingCapture, dpCapture],
  );

  const handleResultPreview = useCallback(
    (result: 'win' | 'loss') => {
      captureLog('duel', `handleResultPreview ${result} (autoConfirm=${autoConfirmEnabledRef.current})`);
      emitRef.current({ type: 'result-preview', result });
      dispatchWorkflow({
        type: 'result-confirmed',
        result,
        autoConfirm: autoConfirmEnabledRef.current,
      });
    },
    [dispatchWorkflow],
  );

  const handleResultScreenCleared = useCallback(() => {
    captureLog('duel', 'handleResultScreenCleared');
    dispatchWorkflow({ type: 'screen-cleared' });
  }, [dispatchWorkflow]);

  const resultCapture = useResultCaptureLoop({
    canvasRef,
    detect,
    disposeDetector: dispose,
    onResultPreview: handleResultPreview,
    onResultScreenCleared: handleResultScreenCleared,
    detectPostDuelScreen: isPostDuelDark,
  });

  const captureState: DuelCaptureState = mapWorkflowPhaseToCaptureState(workflowState.phase);

  const isStoppedRef = useRef(false);
  const hasResultCandidateRef = useRef(false);
  const ocrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const turnOrderCapture = useTurnOrderCaptureLoop({
    canvasRef,
    captureCurrentFrame,
  });

  const start = useCallback(async () => {
    await startCapture();
  }, [startCapture]);

  const resetDetectionState = useCallback(
    (options: { resetResult: boolean; restartTurnOrder: boolean }) => {
      hasResultCandidateRef.current = false;
      if (options.resetResult) resultCapture.reset();
      if (options.restartTurnOrder) {
        turnOrderCapture.restart();
      } else {
        turnOrderCapture.reset();
      }
    },
    [resultCapture, turnOrderCapture],
  );

  const stop = useCallback(() => {
    captureLog('duel', 'stop');
    isStoppedRef.current = true;
    stopCapture();
    if (ocrTimerRef.current) {
      clearTimeout(ocrTimerRef.current);
      ocrTimerRef.current = null;
    }
    hasResultCandidateRef.current = false;
    dispatchWorkflow({ type: 'stop' });
    resultCapture.reset();
    resultCapture.dispose();
    turnOrderCapture.reset();
    ratingCapture.reset();
    dpCapture.reset();
  }, [stopCapture, dispatchWorkflow, resultCapture, turnOrderCapture, ratingCapture, dpCapture]);

  const prepareNextDuelDetection = useCallback(() => {
    captureLog('duel', 'prepareNextDuelDetection (record saved → next duel)');
    dispatchWorkflow({ type: 'record-saved' });
    resetDetectionState({ resetResult: true, restartTurnOrder: isCapturing });
    ratingCapture.reset();
    dpCapture.reset();
  }, [dispatchWorkflow, isCapturing, resetDetectionState, ratingCapture, dpCapture]);

  const restartTurnOrderDetection = useCallback(() => {
    resetDetectionState({ resetResult: false, restartTurnOrder: isCapturing });
  }, [isCapturing, resetDetectionState]);

  const captureRatingOnce = useCallback(async (): Promise<number | null> => {
    if (!isCapturing || !canvasRef.current) return null;
    if (!captureCurrentFrame()) return null;
    const worker = await createRatingOcrWorker();
    try {
      return await detectRatingFromScreen(worker, canvasRef.current);
    } finally {
      await worker.terminate();
    }
  }, [isCapturing, captureCurrentFrame]);

  const captureDpOnce = useCallback(async (): Promise<number | null> => {
    if (!isCapturing || !canvasRef.current) return null;
    if (!captureCurrentFrame()) return null;
    const worker = await createDpOcrWorker();
    try {
      return await detectDpFromScreen(worker, canvasRef.current);
    } finally {
      await worker.terminate();
    }
  }, [isCapturing, captureCurrentFrame]);

  const captureCurrentFrameDataUrl = useCallback((): string | null => {
    if (!captureCurrentFrame()) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvasToDataUrl(canvas);
  }, [captureCurrentFrame]);

  const downloadCurrentFrame = useCallback(() => {
    const dataUrl = captureCurrentFrameDataUrl();
    if (!dataUrl) return;
    downloadDataUrl(dataUrl, createCaptureFilename('current'));
  }, [captureCurrentFrameDataUrl]);

  const downloadFirstCandidateFrame = useCallback(() => {
    const dataUrl = resultCapture.firstCandidateFrameDataUrl;
    if (!dataUrl) return;
    downloadDataUrl(dataUrl, createCaptureFilename('result-candidate'));
  }, [resultCapture.firstCandidateFrameDataUrl]);

  const downloadRatingFrame = useCallback(() => {
    const dataUrl = ratingCapture.ratingFrameDataUrl;
    if (!dataUrl) return;
    downloadDataUrl(dataUrl, createCaptureFilename('rating-candidate'));
  }, [ratingCapture.ratingFrameDataUrl]);

  const downloadDpFrame = useCallback(() => {
    const dataUrl = dpCapture.ratingFrameDataUrl;
    if (!dataUrl) return;
    downloadDataUrl(dataUrl, createCaptureFilename('dp-candidate'));
  }, [dpCapture.ratingFrameDataUrl]);

  useEffect(() => {
    if (!isCapturing) {
      dispatchWorkflow({ type: 'stop' });
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let isEffectActive = true;
    isStoppedRef.current = false;
    hasResultCandidateRef.current = false;
    // Phase 0: captureDebug 有効時のみプロファイラを有効化し、今回のキャプチャ分から集計し直す。
    setProfilerEnabled(getCaptureDebugEnabled());
    resetProfile();
    captureLog('duel', 'capture started');
    dispatchWorkflow({ type: 'start' });
    turnOrderCapture.start();

    // 次フレームは「処理に要した時間」を差し引いて予約する。setTimeout は処理後にさらに
    // interval 待つため、補正しないと実効周期が interval + 処理時間になり 30fps に届かない
    // （補正前の実測 24.8fps）。OCR 等で interval を超えた場合は即次へ（delay 0）。
    const scheduleNextOcr = (tickStartedAt?: number) => {
      if (!isEffectActive || isStoppedRef.current) return;
      const interval = sampleIntervalRef.current;
      const elapsed = tickStartedAt === undefined ? 0 : performance.now() - tickStartedAt;
      ocrTimerRef.current = setTimeout(runOcr, Math.max(0, interval - elapsed));
    };

    const runOcr = async () => {
      if (!isEffectActive) return;

      const tickStartedAt = performance.now();
      recordTick('result-loop');
      if (!captureCurrentFrame()) {
        scheduleNextOcr(tickStartedAt);
        return;
      }
      const mode = workflowStateRef.current.phase === 'waiting-clear' ? 'gate' : 'detect';
      const result = await resultCapture.runOnce(mode);
      hasResultCandidateRef.current = result.hasCandidate;
      scheduleNextOcr(tickStartedAt);
    };

    scheduleNextOcr();

    return () => {
      isEffectActive = false;
      isStoppedRef.current = true;
      if (ocrTimerRef.current) {
        clearTimeout(ocrTimerRef.current);
        ocrTimerRef.current = null;
      }
      turnOrderCapture.stop();
      resultCapture.dispose();
    };
  }, [isCapturing]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    captureState,
    pendingResult: resultCapture.pendingResult,
    lastOcrResult: resultCapture.lastOcrResult,
    consecutiveCount: resultCapture.consecutiveCount,
    requiredConsecutiveCount: resultCapture.requiredConsecutiveCount,
    videoRef,
    canvasRef,
    isCapturing,
    error,
    autoConfirmEnabled,
    setAutoConfirmEnabled,
    captureFps,
    setCaptureFps,
    hasFirstCandidateFrame: resultCapture.hasFirstCandidateFrame,
    hasCoinTossFrame: turnOrderCapture.hasCoinTossFrame,
    hasRatingFrame: ratingCapture.hasRatingFrame,
    hasDpFrame: dpCapture.hasRatingFrame,
    coinTossDebug: turnOrderCapture.coinTossDebug,
    turnOrderDetection: turnOrderCapture.turnOrderDetection,
    clearTurnOrderDetection: turnOrderCapture.clearTurnOrderDetection,
    ratingDetection: ratingCapture.ratingDetection,
    clearRatingDetection: ratingCapture.clearRatingDetection,
    dpDetection: dpCapture.ratingDetection,
    clearDpDetection: dpCapture.clearRatingDetection,
    captureRatingOnce,
    captureDpOnce,
    captureCurrentFrameDataUrl,
    restartTurnOrderDetection,
    prepareNextDuelDetection,
    setPostResultScanMode,
    downloadCurrentFrame,
    downloadFirstCandidateFrame,
    downloadCoinTossFrame: turnOrderCapture.downloadFrame,
    downloadRatingFrame,
    downloadDpFrame,
    start,
    stop,
  };
}
