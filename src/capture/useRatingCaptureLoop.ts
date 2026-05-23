import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Worker } from 'tesseract.js';
import { getElapsedMs } from './captureTiming';
import { canvasToDataUrl } from './captureDebug';
import { createJpnOcrWorker } from './coinTossDetect';
import { detectRatingFromScreen } from './ratingDetect';

// VICTORY/LOSE 画面消去後 60 秒間レーティング検出を行う
export const RATING_ACTIVE_DURATION_MS = 60_000;
// 500ms 間隔でスキャン
export const RATING_INTERVAL_MS = 500;
// 同じ値を 3 回連続検出したら確定
const REQUIRED_CONSECUTIVE = 3;

export interface RatingDetectionEvent {
  id: number;
  rating: number;
  detectedAt: number;
}

export interface RatingCaptureLoop {
  ratingDetection: RatingDetectionEvent | null;
  clearRatingDetection: () => void;
  hasRatingFrame: boolean;
  ratingFrameDataUrl: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

interface RatingCaptureLoopDependencies {
  createWorker: () => Promise<Worker>;
  detectRating: (
    worker: Worker,
    canvas: HTMLCanvasElement,
    reusableCanvasRef?: { current: HTMLCanvasElement | null },
  ) => Promise<number | null>;
}

interface UseRatingCaptureLoopOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onRatingDetected: (rating: number) => void;
  dependencies?: Partial<RatingCaptureLoopDependencies>;
}

const defaultDependencies: RatingCaptureLoopDependencies = {
  createWorker: createJpnOcrWorker,
  detectRating: detectRatingFromScreen,
};

export function useRatingCaptureLoop({
  canvasRef,
  onRatingDetected,
  dependencies,
}: UseRatingCaptureLoopOptions): RatingCaptureLoop {
  const depsRef = useRef({ ...defaultDependencies, ...dependencies });
  const onRatingDetectedRef = useRef(onRatingDetected);

  const [ratingDetection, setRatingDetection] = useState<RatingDetectionEvent | null>(null);
  const [ratingFrameDataUrl, setRatingFrameDataUrl] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const isActiveRef = useRef(false);
  const generationRef = useRef(0);
  const startTimeRef = useRef(0);
  const detectionIdRef = useRef(0);
  const reusableOcrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastDetectedRatingRef = useRef<number | null>(null);
  const consecutiveCountRef = useRef(0);

  useEffect(() => {
    depsRef.current = { ...defaultDependencies, ...dependencies };
  }, [dependencies]);

  useEffect(() => {
    onRatingDetectedRef.current = onRatingDetected;
  }, [onRatingDetected]);

  const clearRatingDetection = useCallback(() => {
    setRatingDetection(null);
  }, []);

  const stop = useCallback(() => {
    isActiveRef.current = false;
    generationRef.current += 1;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const worker = workerRef.current;
    workerRef.current = null;
    runningRef.current = false;
    if (worker) void worker.terminate();
  }, []);

  const reset = useCallback(() => {
    stop();
    lastDetectedRatingRef.current = null;
    consecutiveCountRef.current = 0;
    reusableOcrCanvasRef.current = null;
    setRatingFrameDataUrl(null);
  }, [stop]);

  const start = useCallback(() => {
    reset();
    isActiveRef.current = true;
    startTimeRef.current = Date.now();
    const generation = generationRef.current;

    const scheduleNext = () => {
      if (generation !== generationRef.current || !isActiveRef.current) return;
      timerRef.current = setTimeout(runOcr, RATING_INTERVAL_MS);
    };

    const runOcr = async () => {
      if (
        generation !== generationRef.current ||
        !isActiveRef.current ||
        runningRef.current
      ) {
        return;
      }

      if (getElapsedMs(startTimeRef.current) > RATING_ACTIVE_DURATION_MS) {
        stop();
        return;
      }

      const worker = workerRef.current;
      const canvas = canvasRef.current;
      if (!worker || !canvas) {
        scheduleNext();
        return;
      }

      runningRef.current = true;
      let rating: number | null = null;
      try {
        rating = await depsRef.current.detectRating(worker, canvas, reusableOcrCanvasRef);
      } catch {
        // OCR エラーは無視して継続
      } finally {
        runningRef.current = false;
      }

      if (generation !== generationRef.current || !isActiveRef.current) return;

      if (rating !== null) {
        if (rating === lastDetectedRatingRef.current) {
          consecutiveCountRef.current += 1;
        } else {
          lastDetectedRatingRef.current = rating;
          consecutiveCountRef.current = 1;
          setRatingFrameDataUrl((current) => current ?? canvasToDataUrl(canvas));
        }

        if (consecutiveCountRef.current >= REQUIRED_CONSECUTIVE) {
          const event: RatingDetectionEvent = {
            id: ++detectionIdRef.current,
            rating,
            detectedAt: Date.now(),
          };
          setRatingDetection(event);
          onRatingDetectedRef.current(rating);
          stop();
          return;
        }
      } else {
        lastDetectedRatingRef.current = null;
        consecutiveCountRef.current = 0;
      }

      scheduleNext();
    };

    void (async () => {
      let worker: Worker;
      try {
        worker = await depsRef.current.createWorker();
      } catch {
        return;
      }
      if (generation !== generationRef.current || !isActiveRef.current) {
        void worker.terminate();
        return;
      }
      workerRef.current = worker;
      scheduleNext();
    })();
  }, [canvasRef, reset, stop]);

  useEffect(() => stop, [stop]);

  return {
    ratingDetection,
    clearRatingDetection,
    hasRatingFrame: ratingFrameDataUrl !== null,
    ratingFrameDataUrl,
    start,
    stop,
    reset,
  };
}
