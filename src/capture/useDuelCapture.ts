import { useCallback, useEffect, useRef, useState } from 'react';
import { getElapsedMs, getOcrInterval } from './captureTiming';
import { canvasToDataUrl, createCaptureFilename, downloadDataUrl } from './captureDebug';
import {
  createJpnOcrWorker,
  detectCoinTossScreen,
  detectInDuelBadgeTurnOrderByImageFeatures,
} from './coinTossDetect';
import { INITIAL_COIN_TOSS_STATE, updateCoinTossState } from './coinTossState';
import type { CoinTossDetectionState } from './coinTossState';
import type {
  CoinTossDebugInfo,
  DuelCaptureState,
  TurnOrderDetectionEvent,
  TurnOrderDetectionSource,
} from './types';
import type { TurnOrder } from '../types';
import { useAutoConfirmSetting } from './useAutoConfirmSetting';
import { useCaptureFrame } from './useCaptureFrame';
import { useOcrDetector } from './useOcrDetector';
import { useResultCaptureLoop } from './useResultCaptureLoop';
import { useScreenCapture } from './useScreenCapture';

// コイントス検出は200ms間隔、キャプチャ開始から60秒間有効
const COIN_TOSS_INTERVAL_MS = 200;
const COIN_TOSS_ACTIVE_DURATION_MS = 60_000;
// 相手選択画面検出後30秒以内に結果が出なければ後攻とみなす
const OPPONENT_SELECTING_TIMEOUT_MS = 30_000;

export function getOpponentSelectingFallbackTurnOrder(
  badgeOrder: 'first' | 'second' | null,
): { order: TurnOrder; source: TurnOrderDetectionSource } {
  if (badgeOrder === 'first') return { order: 'third', source: 'in-duel-badge' };
  if (badgeOrder === 'second') return { order: 'second', source: 'in-duel-badge' };
  return { order: 'second', source: 'opponent-timeout' };
}

export function useDuelCapture(
  onResultDetected: (result: 'win' | 'loss') => void,
  onTurnOrderDetected: (order: TurnOrder) => void,
) {
  const { videoRef, isCapturing, error, startCapture, stopCapture } = useScreenCapture();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { captureCurrentFrame } = useCaptureFrame(videoRef, canvasRef);
  const { detect, dispose } = useOcrDetector();

  const { autoConfirmEnabled, setAutoConfirmEnabled } = useAutoConfirmSetting();
  const resultCapture = useResultCaptureLoop({
    canvasRef,
    detect,
    disposeDetector: dispose,
    autoConfirmEnabled,
    onResultDetected,
  });
  const captureState: DuelCaptureState = isCapturing
    ? resultCapture.state === 'scanning'
      ? 'capturing'
      : resultCapture.state
    : 'idle';
  const [hasCoinTossFrame, setHasCoinTossFrame] = useState(false);
  const [coinTossDebug, setCoinTossDebug] = useState<CoinTossDebugInfo | null>(null);
  const [turnOrderDetection, setTurnOrderDetection] = useState<TurnOrderDetectionEvent | null>(
    null,
  );
  const [coinTossDetectionSession, setCoinTossDetectionSession] = useState(0);

  const coinTossFrameRef = useRef<string | null>(null);
  const isStoppedRef = useRef(false);
  const hasResultCandidateRef = useRef(false);

  // コイントス関連 ref
  const coinTossStateRef = useRef<CoinTossDetectionState>(INITIAL_COIN_TOSS_STATE);
  const turnOrderDetectedRef = useRef(false);
  const coinTossTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coinTossWorkerRef = useRef<Awaited<ReturnType<typeof createJpnOcrWorker>> | null>(null);
  const coinTossRunningRef = useRef(false);
  const captureStartTimeRef = useRef<number>(0);
  const opponentSelectingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnOrderDetectionIdRef = useRef(0);

  const ocrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const publishTurnOrderDetected = useCallback(
    (order: TurnOrder, source: TurnOrderDetectionSource) => {
      const event = {
        id: ++turnOrderDetectionIdRef.current,
        order,
        source,
        detectedAt: Date.now(),
      };
      setTurnOrderDetection(event);
      onTurnOrderDetected(order);
    },
    [onTurnOrderDetected],
  );

  const clearTurnOrderDetection = useCallback(() => {
    setTurnOrderDetection(null);
  }, []);

  const start = useCallback(async () => {
    await startCapture();
  }, [startCapture]);

  const resetCoinTossFrame = useCallback(() => {
    coinTossFrameRef.current = null;
    setHasCoinTossFrame(false);
  }, []);

  const resetCoinTossDebug = useCallback(() => {
    setCoinTossDebug(null);
  }, []);

  const stopCoinTossDetection = useCallback(() => {
    if (coinTossTimerRef.current) {
      clearTimeout(coinTossTimerRef.current);
      coinTossTimerRef.current = null;
    }
    if (opponentSelectingTimeoutRef.current) {
      clearTimeout(opponentSelectingTimeoutRef.current);
      opponentSelectingTimeoutRef.current = null;
    }
    const worker = coinTossWorkerRef.current;
    coinTossWorkerRef.current = null;
    coinTossRunningRef.current = false;
    if (worker) void worker.terminate();
  }, []);

  const stop = useCallback(() => {
    isStoppedRef.current = true;
    stopCapture();
    if (ocrTimerRef.current) {
      clearTimeout(ocrTimerRef.current);
      ocrTimerRef.current = null;
    }
    stopCoinTossDetection();
    hasResultCandidateRef.current = false;
    resultCapture.reset();
    resetCoinTossFrame();
    resultCapture.dispose();
    coinTossStateRef.current = INITIAL_COIN_TOSS_STATE;
    turnOrderDetectedRef.current = false;
    resetCoinTossDebug();
  }, [
    stopCapture,
    resultCapture,
    resetCoinTossFrame,
    stopCoinTossDetection,
    resetCoinTossDebug,
  ]);

  const prepareNextDuelDetection = useCallback(() => {
    hasResultCandidateRef.current = false;
    resultCapture.reset();
    resetCoinTossFrame();
    stopCoinTossDetection();
    coinTossStateRef.current = INITIAL_COIN_TOSS_STATE;
    turnOrderDetectedRef.current = false;
    captureStartTimeRef.current = Date.now();
    resetCoinTossDebug();
    clearTurnOrderDetection();
    if (isCapturing) {
      setCoinTossDetectionSession((session) => session + 1);
    }
  }, [
    clearTurnOrderDetection,
    isCapturing,
    resultCapture,
    resetCoinTossFrame,
    resetCoinTossDebug,
    stopCoinTossDetection,
  ]);

  const restartTurnOrderDetection = useCallback(() => {
    stopCoinTossDetection();
    coinTossStateRef.current = INITIAL_COIN_TOSS_STATE;
    turnOrderDetectedRef.current = false;
    captureStartTimeRef.current = Date.now();
    resetCoinTossDebug();
    resetCoinTossFrame();
    clearTurnOrderDetection();
    if (isCapturing) {
      setCoinTossDetectionSession((session) => session + 1);
    }
  }, [
    clearTurnOrderDetection,
    isCapturing,
    resetCoinTossFrame,
    resetCoinTossDebug,
    stopCoinTossDetection,
  ]);

  const downloadCurrentFrame = useCallback(() => {
    if (!captureCurrentFrame()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvasToDataUrl(canvas);
    if (!dataUrl) return;
    downloadDataUrl(dataUrl, createCaptureFilename('current'));
  }, [captureCurrentFrame]);

  const downloadFirstCandidateFrame = useCallback(() => {
    const dataUrl = resultCapture.firstCandidateFrameDataUrl;
    if (!dataUrl) return;
    downloadDataUrl(dataUrl, createCaptureFilename('result-candidate'));
  }, [resultCapture.firstCandidateFrameDataUrl]);

  const downloadCoinTossFrame = useCallback(() => {
    const dataUrl = coinTossFrameRef.current;
    if (!dataUrl) return;
    downloadDataUrl(dataUrl, createCaptureFilename('coin-toss'));
  }, []);

  useEffect(() => {
    if (!isCapturing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let isEffectActive = true;
    isStoppedRef.current = false;
    hasResultCandidateRef.current = false;
    captureStartTimeRef.current = Date.now();
    coinTossStateRef.current = INITIAL_COIN_TOSS_STATE;
    turnOrderDetectedRef.current = false;
    resetCoinTossDebug();
    resetCoinTossFrame();

    const scheduleNextOcr = () => {
      if (!isEffectActive || isStoppedRef.current) return;
      ocrTimerRef.current = setTimeout(runOcr, getOcrInterval(hasResultCandidateRef.current));
    };

    // コイントス検出ループ（日本語OCRワーカー、250ms間隔）
    const startCoinTossLoop = async () => {
      let worker: Awaited<ReturnType<typeof createJpnOcrWorker>>;
      try {
        worker = await createJpnOcrWorker();
      } catch {
        return;
      }
      if (!isEffectActive || isStoppedRef.current) {
        void worker.terminate();
        return;
      }
      coinTossWorkerRef.current = worker;
      scheduleCoinTossOcr();
    };

    const scheduleCoinTossOcr = () => {
      if (!isEffectActive || isStoppedRef.current || turnOrderDetectedRef.current) return;
      coinTossTimerRef.current = setTimeout(runCoinTossOcr, COIN_TOSS_INTERVAL_MS);
    };

    const runCoinTossOcr = async () => {
      if (
        !isEffectActive ||
        isStoppedRef.current ||
        turnOrderDetectedRef.current ||
        coinTossRunningRef.current
      ) {
        return;
      }

      const elapsed = getElapsedMs(captureStartTimeRef.current);
      if (elapsed > COIN_TOSS_ACTIVE_DURATION_MS) {
        stopCoinTossDetection();
        return;
      }

      const worker = coinTossWorkerRef.current;
      if (!worker) return;

      coinTossRunningRef.current = true;
      if (!captureCurrentFrame()) {
        coinTossRunningRef.current = false;
        scheduleCoinTossOcr();
        return;
      }
      const coinTossFrame = canvasToDataUrl(canvas);
      if (coinTossFrame) {
        coinTossFrameRef.current = coinTossFrame;
        setHasCoinTossFrame(true);
      }
      try {
        const screen = await detectCoinTossScreen(
          worker,
          canvas as unknown as Blob,
          canvas.width,
          canvas.height,
        );
        if (!isEffectActive || isStoppedRef.current) return;

        const prevState = coinTossStateRef.current;
        const newState = updateCoinTossState(prevState, screen);
        coinTossStateRef.current = newState;
        setCoinTossDebug({
          screen,
          opponentSelectingDetected: newState.opponentSelectingDetected,
          result: newState.result,
          elapsedMs: elapsed,
          updatedAt: Date.now(),
        });

        // 相手選択画面を初めて検出したらタイムアウトタイマーを設定
        if (newState.opponentSelectingDetected && !prevState.opponentSelectingDetected) {
          opponentSelectingTimeoutRef.current = setTimeout(() => {
            void (async () => {
              if (
                turnOrderDetectedRef.current ||
                !coinTossStateRef.current.opponentSelectingDetected ||
                !isEffectActive ||
                isStoppedRef.current
              ) {
                return;
              }

              let badgeOrder: 'first' | 'second' | null = null;
              try {
                badgeOrder = captureCurrentFrame()
                  ? await detectInDuelBadgeTurnOrderByImageFeatures(canvas as unknown as Blob)
                  : null;
              } catch {
                badgeOrder = null;
              }
              if (
                turnOrderDetectedRef.current ||
                !coinTossStateRef.current.opponentSelectingDetected ||
                !isEffectActive ||
                isStoppedRef.current
              ) {
                return;
              }

              const fallback = getOpponentSelectingFallbackTurnOrder(badgeOrder);
              turnOrderDetectedRef.current = true;
              setCoinTossDebug((current) =>
                current
                  ? {
                      ...current,
                      result: fallback.order,
                      elapsedMs: getElapsedMs(captureStartTimeRef.current),
                      updatedAt: Date.now(),
                    }
                  : {
                      screen: null,
                      opponentSelectingDetected: true,
                      result: fallback.order,
                      elapsedMs: getElapsedMs(captureStartTimeRef.current),
                      updatedAt: Date.now(),
                    },
              );
              publishTurnOrderDetected(fallback.order, fallback.source);
              stopCoinTossDetection();
            })();
          }, OPPONENT_SELECTING_TIMEOUT_MS);
        }

        if (newState.result && !turnOrderDetectedRef.current) {
          turnOrderDetectedRef.current = true;
          publishTurnOrderDetected(newState.result, 'coin-toss-ocr');
          stopCoinTossDetection();
          return;
        }
      } catch {
        // OCRエラーは無視して継続
      } finally {
        coinTossRunningRef.current = false;
      }

      scheduleCoinTossOcr();
    };

    void startCoinTossLoop();

    const runOcr = async () => {
      if (!isEffectActive) return;

      if (!captureCurrentFrame()) {
        scheduleNextOcr();
        return;
      }
      const result = await resultCapture.runOnce();
      hasResultCandidateRef.current = result.hasCandidate;
      scheduleNextOcr();
    };

    scheduleNextOcr();

    return () => {
      isEffectActive = false;
      isStoppedRef.current = true;
      if (ocrTimerRef.current) {
        clearTimeout(ocrTimerRef.current);
        ocrTimerRef.current = null;
      }
      stopCoinTossDetection();
      resultCapture.dispose();
    };
  }, [isCapturing, coinTossDetectionSession]); // eslint-disable-line react-hooks/exhaustive-deps

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
    hasFirstCandidateFrame: resultCapture.hasFirstCandidateFrame,
    hasCoinTossFrame,
    coinTossDebug,
    turnOrderDetection,
    clearTurnOrderDetection,
    restartTurnOrderDetection,
    prepareNextDuelDetection,
    downloadCurrentFrame,
    downloadFirstCandidateFrame,
    downloadCoinTossFrame,
    start,
    stop,
    confirm: resultCapture.confirm,
    dismiss: resultCapture.dismiss,
  };
}
