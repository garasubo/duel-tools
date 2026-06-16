import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Worker } from 'tesseract.js';
import { canvasToDataUrl } from './captureDebug';
import { measureAsync, recordTick } from './captureProfiler';
import { createRatingOcrWorker, detectRatingFromScreen } from './ratingDetect';

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

export interface RatingStreakState {
  lastRating: number | null;
  consecutiveCount: number;
  confirmedRating: number | null;
}

export interface RatingStreakUpdate {
  nextStreak: RatingStreakState;
  confirmedRating: number | null;
}

export const EMPTY_RATING_STREAK: RatingStreakState = {
  lastRating: null,
  consecutiveCount: 0,
  confirmedRating: null,
};

export function advanceRatingStreak(
  streak: RatingStreakState,
  rating: number | null,
): RatingStreakUpdate {
  if (rating === null) {
    return {
      nextStreak: EMPTY_RATING_STREAK,
      confirmedRating: null,
    };
  }

  const isSameRating = rating === streak.lastRating;
  const consecutiveCount = isSameRating ? streak.consecutiveCount + 1 : 1;
  const confirmedRating =
    consecutiveCount >= REQUIRED_CONSECUTIVE && rating !== streak.confirmedRating ? rating : null;

  return {
    nextStreak: {
      lastRating: rating,
      consecutiveCount,
      confirmedRating: confirmedRating ?? streak.confirmedRating,
    },
    confirmedRating,
  };
}

const defaultDependencies: RatingCaptureLoopDependencies = {
  createWorker: createRatingOcrWorker,
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
  const detectionIdRef = useRef(0);
  const reusableOcrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streakRef = useRef<RatingStreakState>(EMPTY_RATING_STREAK);

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
    streakRef.current = EMPTY_RATING_STREAK;
    reusableOcrCanvasRef.current = null;
    setRatingDetection(null);
    setRatingFrameDataUrl(null);
  }, [stop]);

  const start = useCallback(() => {
    reset();
    isActiveRef.current = true;
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

      const worker = workerRef.current;
      const canvas = canvasRef.current;
      if (!worker || !canvas) {
        scheduleNext();
        return;
      }

      recordTick('rating-loop');
      runningRef.current = true;
      let rating: number | null = null;
      try {
        rating = await measureAsync('rating-detect', () =>
          depsRef.current.detectRating(worker, canvas, reusableOcrCanvasRef),
        );
      } catch {
        // OCR エラーは無視して継続
      } finally {
        runningRef.current = false;
      }

      if (generation !== generationRef.current || !isActiveRef.current) return;

      if (rating !== null && rating !== streakRef.current.lastRating) {
        setRatingFrameDataUrl((current) => current ?? canvasToDataUrl(canvas));
      }

      const update = advanceRatingStreak(streakRef.current, rating);
      streakRef.current = update.nextStreak;

      if (update.confirmedRating !== null) {
        const event: RatingDetectionEvent = {
          id: ++detectionIdRef.current,
          rating: update.confirmedRating,
          detectedAt: Date.now(),
        };
        setRatingDetection(event);
        onRatingDetectedRef.current(update.confirmedRating);
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
  }, [canvasRef, reset]);

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
