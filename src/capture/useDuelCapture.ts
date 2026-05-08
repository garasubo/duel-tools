import { useCallback, useEffect, useRef } from 'react';
import { getOcrInterval } from './captureTiming';
import { canvasToDataUrl, createCaptureFilename, downloadDataUrl } from './captureDebug';
import type { DuelCaptureState } from './types';
import { useAutoConfirmSetting } from './useAutoConfirmSetting';
import { useCaptureFrame } from './useCaptureFrame';
import { useOcrDetector } from './useOcrDetector';
import { useResultCaptureLoop } from './useResultCaptureLoop';
import { useScreenCapture } from './useScreenCapture';
import { useTurnOrderCaptureLoop } from './useTurnOrderCaptureLoop';
import type { TurnOrder } from '../types';
export { getOpponentSelectingFallbackTurnOrder } from './useTurnOrderCaptureLoop';

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
  }, [stopCapture, resultCapture, turnOrderCapture]);

  const prepareNextDuelDetection = useCallback(() => {
    resetDetectionState({ resetResult: true, restartTurnOrder: isCapturing });
  }, [isCapturing, resetDetectionState]);

  const restartTurnOrderDetection = useCallback(() => {
    resetDetectionState({ resetResult: false, restartTurnOrder: isCapturing });
  }, [isCapturing, resetDetectionState]);

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
    coinTossDebug: turnOrderCapture.coinTossDebug,
    turnOrderDetection: turnOrderCapture.turnOrderDetection,
    clearTurnOrderDetection: turnOrderCapture.clearTurnOrderDetection,
    restartTurnOrderDetection,
    prepareNextDuelDetection,
    downloadCurrentFrame,
    downloadFirstCandidateFrame,
    downloadCoinTossFrame: turnOrderCapture.downloadFrame,
    start,
    stop,
    confirm: resultCapture.confirm,
    dismiss: resultCapture.dismiss,
  };
}
