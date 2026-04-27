import { useCallback, useEffect, useRef, useState } from 'react';
import {
  averageConfidence,
  getOcrInterval,
  getRequiredConsecutive,
  REQUIRED_CONSECUTIVE,
} from './captureTiming';
import { createCaptureFilename } from './captureDebug';
import { DEFAULT_RESULT_ROI } from './types';
import type { DetectionResult, DuelCaptureState } from './types';
import { updateResultScreenGate } from './resultScreenGate';
import { useFrameSampler } from './useFrameSampler';
import { useOcrDetector } from './useOcrDetector';
import { useScreenCapture } from './useScreenCapture';

const AUTO_CONFIRM_STORAGE_KEY = 'duel-tools:auto-confirm-result';

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

export function useDuelCapture(onResultDetected: (result: 'win' | 'loss') => void) {
  const { videoRef, isCapturing, error, startCapture, stopCapture } = useScreenCapture();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sampler = useFrameSampler(750);
  const { detect, dispose } = useOcrDetector();

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

  // captureState の ref を同期（クロージャ内で使うため）
  useEffect(() => {
    captureStateRef.current = captureState;
  }, [captureState]);

  useEffect(() => {
    pendingResultRef.current = pendingResult;
  }, [pendingResult]);

  useEffect(() => {
    autoConfirmEnabledRef.current = autoConfirmEnabled;
  }, [autoConfirmEnabled]);

  // フレームサンプリング後に OCR を実行するタイマー
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

  const stop = useCallback(() => {
    isStoppedRef.current = true;
    stopCapture();
    sampler.stop();
    if (ocrTimerRef.current) {
      clearTimeout(ocrTimerRef.current);
      ocrTimerRef.current = null;
    }
    resetOcrState();
    resetCandidateFrame();
    setPendingResult(null);
    setCaptureState('idle');
    dispose();
  }, [stopCapture, sampler, resetOcrState, resetCandidateFrame, dispose]);

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

  // isCapturing が変わったときにフレームサンプリングと OCR を開始/停止
  useEffect(() => {
    if (!isCapturing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    isStoppedRef.current = false;
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
