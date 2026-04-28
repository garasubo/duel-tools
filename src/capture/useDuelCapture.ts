import { useCallback, useEffect, useRef, useState } from 'react';
import {
  averageConfidence,
  getOcrInterval,
  getRequiredConsecutive,
  REQUIRED_CONSECUTIVE,
} from './captureTiming';
import { createCaptureFilename } from './captureDebug';
import {
  createJpnOcrWorker,
  detectCoinTossScreen,
  IN_DUEL_BADGE_ROI,
  parseInDuelTurnOrder,
} from './coinTossDetect';
import { INITIAL_COIN_TOSS_STATE, updateCoinTossState } from './coinTossState';
import type { CoinTossDetectionState } from './coinTossState';
import { DEFAULT_RESULT_ROI } from './types';
import type { DetectionResult, DuelCaptureState } from './types';
import type { TurnOrder } from '../types';
import { updateResultScreenGate } from './resultScreenGate';
import { useFrameSampler } from './useFrameSampler';
import { useOcrDetector } from './useOcrDetector';
import { useScreenCapture } from './useScreenCapture';

const AUTO_CONFIRM_STORAGE_KEY = 'duel-tools:auto-confirm-result';

// コイントス検出は250ms間隔、キャプチャ開始から60秒間有効
const COIN_TOSS_INTERVAL_MS = 250;
const COIN_TOSS_ACTIVE_DURATION_MS = 60_000;
// 相手選択画面検出後30秒以内に結果が出なければ後攻とみなす
const OPPONENT_SELECTING_TIMEOUT_MS = 30_000;
// デュエル中フォールバック: キャプチャ開始から45秒後に有効化
const IN_DUEL_FALLBACK_DELAY_MS = 45_000;

function getInitialAutoConfirmEnabled() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(AUTO_CONFIRM_STORAGE_KEY) === '1';
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function canvasToDataUrl(canvas: HTMLCanvasElement): string | null {
  if (canvas.width === 0 || canvas.height === 0) return null;
  return canvas.toDataURL('image/png');
}

export function useDuelCapture(
  onResultDetected: (result: 'win' | 'loss') => void,
  onTurnOrderDetected: (order: TurnOrder) => void,
) {
  const { videoRef, isCapturing, error, startCapture, stopCapture } = useScreenCapture();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sampler = useFrameSampler(750);
  const { detect, detectRawText, dispose } = useOcrDetector();

  const [captureState, setCaptureState] = useState<DuelCaptureState>('idle');
  const [pendingResult, setPendingResult] = useState<DetectionResult | null>(null);
  const [lastOcrResult, setLastOcrResult] = useState<'win' | 'loss' | null>(null);
  const [consecutiveCount, setConsecutiveCount] = useState(0);
  const [requiredConsecutiveCount, setRequiredConsecutiveCount] = useState(REQUIRED_CONSECUTIVE);
  const [autoConfirmEnabled, setAutoConfirmEnabledState] = useState(getInitialAutoConfirmEnabled);
  const [hasFirstCandidateFrame, setHasFirstCandidateFrame] = useState(false);

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

  const setAutoConfirmEnabled = useCallback((enabled: boolean) => {
    setAutoConfirmEnabledState(enabled);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTO_CONFIRM_STORAGE_KEY, enabled ? '1' : '0');
    }
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
  }, [stopCapture, sampler, resetOcrState, resetCandidateFrame, dispose, stopCoinTossDetection]);

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

    isStoppedRef.current = false;
    captureStartTimeRef.current = Date.now();
    coinTossStateRef.current = INITIAL_COIN_TOSS_STATE;
    turnOrderDetectedRef.current = false;
    sampler.start(video, canvas);

    const scheduleNextOcr = () => {
      if (isStoppedRef.current) return;
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
      try {
        coinTossWorkerRef.current = await createJpnOcrWorker();
      } catch {
        return;
      }
      scheduleCoinTossOcr();
    };

    const scheduleCoinTossOcr = () => {
      if (isStoppedRef.current || turnOrderDetectedRef.current) return;
      coinTossTimerRef.current = setTimeout(runCoinTossOcr, COIN_TOSS_INTERVAL_MS);
    };

    const runCoinTossOcr = async () => {
      if (isStoppedRef.current || turnOrderDetectedRef.current || coinTossRunningRef.current) return;

      const elapsed = Date.now() - captureStartTimeRef.current;
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

        const prevState = coinTossStateRef.current;
        const newState = updateCoinTossState(prevState, screen);
        coinTossStateRef.current = newState;

        // 相手選択画面を初めて検出したらタイムアウトタイマーを設定
        if (newState.opponentSelectingDetected && !prevState.opponentSelectingDetected) {
          opponentSelectingTimeoutRef.current = setTimeout(() => {
            if (!turnOrderDetectedRef.current && coinTossStateRef.current.opponentSelectingDetected) {
              turnOrderDetectedRef.current = true;
              onTurnOrderDetected('second');
            }
          }, OPPONENT_SELECTING_TIMEOUT_MS);
        }

        if (newState.result && !turnOrderDetectedRef.current) {
          turnOrderDetectedRef.current = true;
          onTurnOrderDetected(newState.result);
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

    // デュエル中ターン判定フォールバック（既存Englishワーカーのバッジ領域OCR）
    const runInDuelTurnDetection = async () => {
      if (turnOrderDetectedRef.current || !canvas.width || !canvas.height) return;
      const text = await detectRawText(canvas, IN_DUEL_BADGE_ROI);
      if (!text) return;
      const order = parseInDuelTurnOrder(text);
      if (order && !turnOrderDetectedRef.current) {
        turnOrderDetectedRef.current = true;
        onTurnOrderDetected(order);
      }
    };

    const runOcr = async () => {
      if (captureStateRef.current === 'detected' && !autoConfirmEnabledRef.current) {
        scheduleNextOcr();
        return;
      }

      captureVideoFrame();
      const result = await detect(canvas, DEFAULT_RESULT_ROI);
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

      // デュエル中フォールバック: 45秒経過後かつ手番未確定の場合に実行
      if (!turnOrderDetectedRef.current) {
        const elapsed = Date.now() - captureStartTimeRef.current;
        if (elapsed >= IN_DUEL_FALLBACK_DELAY_MS) {
          await runInDuelTurnDetection();
        }
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
      isStoppedRef.current = true;
      sampler.stop();
      if (ocrTimerRef.current) {
        clearTimeout(ocrTimerRef.current);
        ocrTimerRef.current = null;
      }
      stopCoinTossDetection();
      dispose();
    };
  }, [isCapturing]); // eslint-disable-line react-hooks/exhaustive-deps

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
    downloadCurrentFrame,
    downloadFirstCandidateFrame,
    start,
    stop,
    confirm,
    dismiss,
  };
}
