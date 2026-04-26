import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_RESULT_ROI } from './types';
import type { DetectionResult, DuelCaptureState } from './types';
import { useFrameSampler } from './useFrameSampler';
import { useOcrDetector } from './useOcrDetector';
import { useScreenCapture } from './useScreenCapture';

const REQUIRED_CONSECUTIVE = 3;

export function useDuelCapture(onResultDetected: (result: 'win' | 'loss') => void) {
  const { videoRef, isCapturing, error, startCapture, stopCapture } = useScreenCapture();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sampler = useFrameSampler(750);
  const { detect } = useOcrDetector();

  const [captureState, setCaptureState] = useState<DuelCaptureState>('idle');
  const [pendingResult, setPendingResult] = useState<DetectionResult | null>(null);
  const [lastOcrResult, setLastOcrResult] = useState<'win' | 'loss' | null>(null);
  const [consecutiveCount, setConsecutiveCount] = useState(0);

  const consecutiveRef = useRef(0);
  const lastResultRef = useRef<'win' | 'loss' | null>(null);
  const captureStateRef = useRef<DuelCaptureState>('idle');

  // captureState の ref を同期（クロージャ内で使うため）
  useEffect(() => {
    captureStateRef.current = captureState;
  }, [captureState]);

  // フレームサンプリング後に OCR を実行するタイマー
  const ocrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async () => {
    await startCapture();
  }, [startCapture]);

  const resetOcrState = useCallback(() => {
    consecutiveRef.current = 0;
    lastResultRef.current = null;
    setLastOcrResult(null);
    setConsecutiveCount(0);
  }, []);

  const stop = useCallback(() => {
    stopCapture();
    sampler.stop();
    if (ocrTimerRef.current) {
      clearInterval(ocrTimerRef.current);
      ocrTimerRef.current = null;
    }
    resetOcrState();
    setPendingResult(null);
    setCaptureState('idle');
  }, [stopCapture, sampler, resetOcrState]);

  const confirm = useCallback(() => {
    if (pendingResult) {
      onResultDetected(pendingResult.result);
    }
    setPendingResult(null);
    resetOcrState();
    setCaptureState('capturing');
  }, [pendingResult, onResultDetected, resetOcrState]);

  const dismiss = useCallback(() => {
    setPendingResult(null);
    resetOcrState();
    setCaptureState('capturing');
  }, [resetOcrState]);

  // isCapturing が変わったときにフレームサンプリングと OCR を開始/停止
  useEffect(() => {
    if (!isCapturing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setCaptureState('capturing');
    sampler.start(video, canvas);

    ocrTimerRef.current = setInterval(async () => {
      if (captureStateRef.current === 'detected') return;
      const result = await detect(canvas, DEFAULT_RESULT_ROI);
      if (!result) {
        consecutiveRef.current = 0;
        lastResultRef.current = null;
        setLastOcrResult(null);
        setConsecutiveCount(0);
        return;
      }
      if (result.result === lastResultRef.current) {
        consecutiveRef.current += 1;
      } else {
        consecutiveRef.current = 1;
        lastResultRef.current = result.result;
      }
      setLastOcrResult(result.result);
      setConsecutiveCount(consecutiveRef.current);
      if (consecutiveRef.current >= REQUIRED_CONSECUTIVE) {
        consecutiveRef.current = 0;
        setPendingResult(result);
        setCaptureState('detected');
      }
    }, 800);

    return () => {
      sampler.stop();
      if (ocrTimerRef.current) {
        clearInterval(ocrTimerRef.current);
        ocrTimerRef.current = null;
      }
    };
  }, [isCapturing]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    captureState,
    pendingResult,
    lastOcrResult,
    consecutiveCount,
    videoRef,
    canvasRef,
    isCapturing,
    error,
    start,
    stop,
    confirm,
    dismiss,
  };
}
