import { useCallback, useEffect, useRef, useState } from 'react';
import {
  averageConfidence,
  getElapsedMs,
  getOcrInterval,
  getRequiredConsecutive,
  REQUIRED_CONSECUTIVE,
} from './captureTiming';
import { canvasToDataUrl, createCaptureFilename, downloadDataUrl } from './captureDebug';
import {
  createJpnOcrWorker,
  detectCoinTossScreen,
  detectInDuelBadgeTurnOrderByImageFeatures,
} from './coinTossDetect';
import { INITIAL_COIN_TOSS_STATE, updateCoinTossState } from './coinTossState';
import type { CoinTossDetectionState } from './coinTossState';
import { DEFAULT_RESULT_ROI } from './types';
import type {
  CoinTossDebugInfo,
  DetectionResult,
  DuelCaptureState,
  TurnOrderDetectionEvent,
  TurnOrderDetectionSource,
} from './types';
import type { TurnOrder } from '../types';
import { updateResultScreenGate } from './resultScreenGate';
import { useAutoConfirmSetting } from './useAutoConfirmSetting';
import { useFrameSampler } from './useFrameSampler';
import { useOcrDetector } from './useOcrDetector';
import { useScreenCapture } from './useScreenCapture';

// コイントス検出は200ms間隔、キャプチャ開始から60秒間有効
const COIN_TOSS_INTERVAL_MS = 200;
const COIN_TOSS_ACTIVE_DURATION_MS = 60_000;
// 相手選択画面検出後30秒以内に結果が出なければ後攻とみなす
const OPPONENT_SELECTING_TIMEOUT_MS = 30_000;
// 右側バッジの画像特徴判定はデュエル開始直後向け。長時間後の結果画面等での誤検知を避ける。
const IN_DUEL_BADGE_FEATURE_ACTIVE_DURATION_MS = 75_000;

export function useDuelCapture(
  onResultDetected: (result: 'win' | 'loss') => void,
  onTurnOrderDetected: (order: TurnOrder) => void,
) {
  const { videoRef, isCapturing, error, startCapture, stopCapture } = useScreenCapture();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sampler = useFrameSampler(750);
  const { detect, dispose } = useOcrDetector();

  const [captureState, setCaptureState] = useState<DuelCaptureState>('idle');
  const [pendingResult, setPendingResult] = useState<DetectionResult | null>(null);
  const [lastOcrResult, setLastOcrResult] = useState<'win' | 'loss' | null>(null);
  const [consecutiveCount, setConsecutiveCount] = useState(0);
  const [requiredConsecutiveCount, setRequiredConsecutiveCount] = useState(REQUIRED_CONSECUTIVE);
  const { autoConfirmEnabled, setAutoConfirmEnabled } = useAutoConfirmSetting();
  const [hasFirstCandidateFrame, setHasFirstCandidateFrame] = useState(false);
  const [coinTossDebug, setCoinTossDebug] = useState<CoinTossDebugInfo | null>(null);
  const [turnOrderDetection, setTurnOrderDetection] = useState<TurnOrderDetectionEvent | null>(
    null,
  );
  const [coinTossDetectionSession, setCoinTossDetectionSession] = useState(0);

  const consecutiveRef = useRef(0);
  const lastResultRef = useRef<'win' | 'loss' | null>(null);
  const recentResultsRef = useRef<DetectionResult[]>([]);
  const captureStateRef = useRef<DuelCaptureState>('idle');
  const clearFrameCountRef = useRef(0);
  const hasCandidateRef = useRef(false);
  const pendingResultRef = useRef<DetectionResult | null>(null);
  const autoConfirmEnabledRef = useRef(autoConfirmEnabled);
  const firstCandidateFrameRef = useRef<string | null>(null);
  const isStoppedRef = useRef(false);

  // コイントス関連 ref
  const coinTossStateRef = useRef<CoinTossDetectionState>(INITIAL_COIN_TOSS_STATE);
  const turnOrderDetectedRef = useRef(false);
  const coinTossTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coinTossWorkerRef = useRef<Awaited<ReturnType<typeof createJpnOcrWorker>> | null>(null);
  const coinTossRunningRef = useRef(false);
  const captureStartTimeRef = useRef<number>(0);
  const opponentSelectingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnOrderDetectionIdRef = useRef(0);

  useEffect(() => {
    captureStateRef.current = captureState;
  }, [captureState]);

  useEffect(() => {
    pendingResultRef.current = pendingResult;
  }, [pendingResult]);

  useEffect(() => {
    autoConfirmEnabledRef.current = autoConfirmEnabled;
  }, [autoConfirmEnabled]);

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
    setCaptureState('capturing');
  }, [startCapture]);

  const resetOcrState = useCallback(() => {
    consecutiveRef.current = 0;
    lastResultRef.current = null;
    recentResultsRef.current = [];
    clearFrameCountRef.current = 0;
    hasCandidateRef.current = false;
    setLastOcrResult(null);
    setConsecutiveCount(0);
    setRequiredConsecutiveCount(REQUIRED_CONSECUTIVE);
  }, []);

  const resetCandidateFrame = useCallback(() => {
    firstCandidateFrameRef.current = null;
    setHasFirstCandidateFrame(false);
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
    sampler.stop();
    if (ocrTimerRef.current) {
      clearTimeout(ocrTimerRef.current);
      ocrTimerRef.current = null;
    }
    stopCoinTossDetection();
    resetOcrState();
    resetCandidateFrame();
    setPendingResult(null);
    setCaptureState('idle');
    dispose();
    coinTossStateRef.current = INITIAL_COIN_TOSS_STATE;
    turnOrderDetectedRef.current = false;
    resetCoinTossDebug();
  }, [
    stopCapture,
    sampler,
    resetOcrState,
    resetCandidateFrame,
    dispose,
    stopCoinTossDetection,
    resetCoinTossDebug,
  ]);

  const confirm = useCallback(() => {
    if (pendingResult) {
      onResultDetected(pendingResult.result);
    }
    setPendingResult(null);
    resetOcrState();
    setCaptureState('waiting-clear');
  }, [pendingResult, onResultDetected, resetOcrState]);

  const dismiss = useCallback(() => {
    setPendingResult(null);
    resetOcrState();
    resetCandidateFrame();
    setCaptureState('capturing');
  }, [resetOcrState, resetCandidateFrame]);

  const prepareNextDuelDetection = useCallback(() => {
    setPendingResult(null);
    resetOcrState();
    resetCandidateFrame();
    if (isCapturing) {
      setCaptureState('capturing');
    }
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
    resetCandidateFrame,
    resetCoinTossDebug,
    resetOcrState,
    stopCoinTossDetection,
  ]);

  const restartTurnOrderDetection = useCallback(() => {
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
    resetCoinTossDebug,
    stopCoinTossDetection,
  ]);

  const downloadCurrentFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvasToDataUrl(canvas);
    if (!dataUrl) return;
    downloadDataUrl(dataUrl, createCaptureFilename('current'));
  }, []);

  const downloadFirstCandidateFrame = useCallback(() => {
    const dataUrl = firstCandidateFrameRef.current;
    if (!dataUrl) return;
    downloadDataUrl(dataUrl, createCaptureFilename('result-candidate'));
  }, []);

  useEffect(() => {
    if (!isCapturing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let isEffectActive = true;
    isStoppedRef.current = false;
    captureStartTimeRef.current = Date.now();
    coinTossStateRef.current = INITIAL_COIN_TOSS_STATE;
    turnOrderDetectedRef.current = false;
    resetCoinTossDebug();
    sampler.start(video, canvas);

    const scheduleNextOcr = () => {
      if (!isEffectActive || isStoppedRef.current) return;
      ocrTimerRef.current = setTimeout(runOcr, getOcrInterval(hasCandidateRef.current));
    };

    const captureVideoFrame = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
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
      captureVideoFrame();
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
            if (!turnOrderDetectedRef.current && coinTossStateRef.current.opponentSelectingDetected) {
              turnOrderDetectedRef.current = true;
              setCoinTossDebug((current) =>
                current
                  ? {
                      ...current,
                      result: 'second',
                      elapsedMs: getElapsedMs(captureStartTimeRef.current),
                      updatedAt: Date.now(),
                    }
                  : {
                      screen: null,
                      opponentSelectingDetected: true,
                      result: 'second',
                      elapsedMs: getElapsedMs(captureStartTimeRef.current),
                      updatedAt: Date.now(),
                    },
              );
              publishTurnOrderDetected('second', 'opponent-timeout');
            }
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

    // デュエル中ターン判定: 開始直後の右側バッジ形状/色を優先して読む。
    const runInDuelBadgeImageDetection = async () => {
      if (!isEffectActive || turnOrderDetectedRef.current || !canvas.width || !canvas.height) return;
      const elapsed = getElapsedMs(captureStartTimeRef.current);
      if (elapsed > IN_DUEL_BADGE_FEATURE_ACTIVE_DURATION_MS) return;
      const order = await detectInDuelBadgeTurnOrderByImageFeatures(canvas as unknown as Blob);
      if (isEffectActive && order && !turnOrderDetectedRef.current) {
        turnOrderDetectedRef.current = true;
        publishTurnOrderDetected(order, 'in-duel-badge');
      }
    };

    const runOcr = async () => {
      if (!isEffectActive) return;
      if (captureStateRef.current === 'detected' && !autoConfirmEnabledRef.current) {
        scheduleNextOcr();
        return;
      }

      captureVideoFrame();
      await runInDuelBadgeImageDetection();
      const result = await detect(canvas, DEFAULT_RESULT_ROI);
      if (!isEffectActive || isStoppedRef.current) return;
      if (captureStateRef.current === 'waiting-clear') {
        const gate = updateResultScreenGate(result !== null, clearFrameCountRef.current);
        clearFrameCountRef.current = gate.clearFrameCount;
        if (gate.isReadyForNextDetection) {
          const pending = pendingResultRef.current;
          if (autoConfirmEnabledRef.current && pending) {
            onResultDetected(pending.result);
            setPendingResult(null);
          }
          resetOcrState();
          resetCandidateFrame();
          setCaptureState('capturing');
        }
        scheduleNextOcr();
        return;
      }

      if (!result) {
        consecutiveRef.current = 0;
        lastResultRef.current = null;
        recentResultsRef.current = [];
        setLastOcrResult(null);
        setConsecutiveCount(0);
        scheduleNextOcr();
        return;
      }
      hasCandidateRef.current = true;
      if (!firstCandidateFrameRef.current) {
        firstCandidateFrameRef.current = canvasToDataUrl(canvas);
        setHasFirstCandidateFrame(firstCandidateFrameRef.current !== null);
      }
      if (result.result === lastResultRef.current) {
        consecutiveRef.current += 1;
        recentResultsRef.current = [...recentResultsRef.current, result].slice(-REQUIRED_CONSECUTIVE);
      } else {
        consecutiveRef.current = 1;
        lastResultRef.current = result.result;
        recentResultsRef.current = [result];
      }
      setLastOcrResult(result.result);
      setConsecutiveCount(consecutiveRef.current);
      const requiredConsecutive = getRequiredConsecutive(result.confidence);
      setRequiredConsecutiveCount(requiredConsecutive);
      if (consecutiveRef.current >= requiredConsecutive) {
        const recentResults = recentResultsRef.current;
        consecutiveRef.current = 0;
        setPendingResult({ ...result, confidence: averageConfidence(recentResults) });
        setCaptureState(autoConfirmEnabledRef.current ? 'waiting-clear' : 'detected');
      }
      scheduleNextOcr();
    };

    scheduleNextOcr();

    return () => {
      isEffectActive = false;
      isStoppedRef.current = true;
      sampler.stop();
      if (ocrTimerRef.current) {
        clearTimeout(ocrTimerRef.current);
        ocrTimerRef.current = null;
      }
      stopCoinTossDetection();
      dispose();
    };
  }, [isCapturing, coinTossDetectionSession]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    captureState,
    pendingResult,
    lastOcrResult,
    consecutiveCount,
    requiredConsecutiveCount,
    videoRef,
    canvasRef,
    isCapturing,
    error,
    autoConfirmEnabled,
    setAutoConfirmEnabled,
    hasFirstCandidateFrame,
    coinTossDebug,
    turnOrderDetection,
    clearTurnOrderDetection,
    restartTurnOrderDetection,
    prepareNextDuelDetection,
    downloadCurrentFrame,
    downloadFirstCandidateFrame,
    start,
    stop,
    confirm,
    dismiss,
  };
}
