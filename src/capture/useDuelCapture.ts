import { useCallback, useEffect, useRef } from 'react';
import { getOcrInterval } from './captureTiming';
import { canvasToDataUrl, createCaptureFilename, downloadDataUrl } from './captureDebug';
import { createJpnOcrWorker } from './coinTossDetect';
import { detectRatingFromScreen } from './ratingDetect';
import type { DuelCaptureState } from './types';
import { useAutoConfirmSetting } from './useAutoConfirmSetting';
import { useCaptureFrame } from './useCaptureFrame';
import { useOcrDetector } from './useOcrDetector';
import { useRatingCaptureLoop } from './useRatingCaptureLoop';
import { useResultCaptureLoop } from './useResultCaptureLoop';
import { useScreenCapture } from './useScreenCapture';
import { useTurnOrderCaptureLoop } from './useTurnOrderCaptureLoop';
import type { TurnOrder } from '../types';
export { getOpponentSelectingFallbackTurnOrder } from './useTurnOrderCaptureLoop';

export function useDuelCapture(
  onResultDetected: (result: 'win' | 'loss') => void,
  onTurnOrderDetected: (order: TurnOrder) => void,
  onResultPreview?: (result: 'win' | 'loss') => void,
  onRatingDetected?: (rating: number) => void,
) {
  const { videoRef, isCapturing, error, startCapture, stopCapture } = useScreenCapture();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { captureCurrentFrame } = useCaptureFrame(videoRef, canvasRef);
  const { detect, dispose } = useOcrDetector();

  const { autoConfirmEnabled, setAutoConfirmEnabled } = useAutoConfirmSetting();

  const onRatingDetectedRef = useRef(onRatingDetected);
  useEffect(() => {
    onRatingDetectedRef.current = onRatingDetected;
  }, [onRatingDetected]);

  const handleRatingDetected = useCallback((rating: number) => {
    onRatingDetectedRef.current?.(rating);
  }, []);

  const ratingCapture = useRatingCaptureLoop({
    canvasRef,
    onRatingDetected: handleRatingDetected,
  });

  const handleResultScreenCleared = useCallback(() => {
    ratingCapture.start();
  }, [ratingCapture]);

  const resultCapture = useResultCaptureLoop({
    canvasRef,
    detect,
    disposeDetector: dispose,
    autoConfirmEnabled,
    onResultDetected,
    onResultPreview,
    onResultScreenCleared: handleResultScreenCleared,
  });
  const captureState: DuelCaptureState = isCapturing
    ? resultCapture.state === 'scanning'
      ? 'capturing'
      : resultCapture.state
    : 'idle';

  const isStoppedRef = useRef(false);
  const hasResultCandidateRef = useRef(false);
  const ocrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const turnOrderCapture = useTurnOrderCaptureLoop({
    canvasRef,
    captureCurrentFrame,
    onTurnOrderDetected,
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
    isStoppedRef.current = true;
    stopCapture();
    if (ocrTimerRef.current) {
      clearTimeout(ocrTimerRef.current);
      ocrTimerRef.current = null;
    }
    hasResultCandidateRef.current = false;
    resultCapture.reset();
    resultCapture.dispose();
    turnOrderCapture.reset();
    ratingCapture.reset();
  }, [stopCapture, resultCapture, turnOrderCapture, ratingCapture]);

  const prepareNextDuelDetection = useCallback(() => {
    resetDetectionState({ resetResult: true, restartTurnOrder: isCapturing });
    ratingCapture.reset();
  }, [isCapturing, resetDetectionState, ratingCapture]);

  const restartTurnOrderDetection = useCallback(() => {
    resetDetectionState({ resetResult: false, restartTurnOrder: isCapturing });
  }, [isCapturing, resetDetectionState]);

  const captureRatingOnce = useCallback(async (): Promise<number | null> => {
    if (!isCapturing || !canvasRef.current) return null;
    if (!captureCurrentFrame()) return null;
    const worker = await createJpnOcrWorker();
    try {
      return await detectRatingFromScreen(worker, canvasRef.current);
    } finally {
      await worker.terminate();
    }
  }, [isCapturing, captureCurrentFrame]);

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

  const downloadRatingFrame = useCallback(() => {
    const dataUrl = ratingCapture.ratingFrameDataUrl;
    if (!dataUrl) return;
    downloadDataUrl(dataUrl, createCaptureFilename('rating-candidate'));
  }, [ratingCapture.ratingFrameDataUrl]);

  useEffect(() => {
    if (!isCapturing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let isEffectActive = true;
    isStoppedRef.current = false;
    hasResultCandidateRef.current = false;
    turnOrderCapture.start();

    const scheduleNextOcr = () => {
      if (!isEffectActive || isStoppedRef.current) return;
      ocrTimerRef.current = setTimeout(runOcr, getOcrInterval(hasResultCandidateRef.current));
    };

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
    hasFirstCandidateFrame: resultCapture.hasFirstCandidateFrame,
    hasCoinTossFrame: turnOrderCapture.hasCoinTossFrame,
    hasRatingFrame: ratingCapture.hasRatingFrame,
    coinTossDebug: turnOrderCapture.coinTossDebug,
    turnOrderDetection: turnOrderCapture.turnOrderDetection,
    clearTurnOrderDetection: turnOrderCapture.clearTurnOrderDetection,
    ratingDetection: ratingCapture.ratingDetection,
    clearRatingDetection: ratingCapture.clearRatingDetection,
    captureRatingOnce,
    restartTurnOrderDetection,
    prepareNextDuelDetection,
    downloadCurrentFrame,
    downloadFirstCandidateFrame,
    downloadCoinTossFrame: turnOrderCapture.downloadFrame,
    downloadRatingFrame,
    start,
    stop,
    confirm: resultCapture.confirm,
    dismiss: resultCapture.dismiss,
  };
}
