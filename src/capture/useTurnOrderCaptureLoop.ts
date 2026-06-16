import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { ImageLike, Worker } from 'tesseract.js';
import { getElapsedMs, isCoinTossWindowExpired } from './captureTiming';
import {
  canvasToDataUrl,
  createCaptureFilename,
  downloadDataUrl,
  getCaptureDebugEnabled,
} from './captureDebug';
import { measureAsync, recordTick } from './captureProfiler';
import {
  createJpnOcrWorker,
  detectCoinTossScreen,
  detectInDuelBadgeTurnOrderByImageFeatures,
} from './coinTossDetect';
import type { CoinTossScreen, DetectCoinTossOptions } from './coinTossDetect';
import type { ROI } from './types';
import { INITIAL_COIN_TOSS_STATE, updateCoinTossState } from './coinTossState';
import type { CoinTossDetectionState } from './coinTossState';
import type {
  CoinTossDebugInfo,
  TurnOrderDetectionEvent,
  TurnOrderDetectionSource,
} from './types';
import type { TurnOrder } from '../types';

// コイントス検出は200ms間隔。有効期限は最初のコイントス画面を検出してから60秒間
//（ロビー画面に長く留まってから試合を始めても最初のコイントスを取りこぼさないため）
export const COIN_TOSS_INTERVAL_MS = 200;
export const COIN_TOSS_ACTIVE_DURATION_MS = 60_000;
// 相手選択画面検出後30秒以内に結果が出なければフォールバックする
export const OPPONENT_SELECTING_TIMEOUT_MS = 30_000;

type BadgeTurnOrder = 'first' | 'second' | null;

interface TurnOrderCaptureLoopDependencies {
  createWorker: () => Promise<Worker>;
  detectCoinToss: (
    worker: Worker,
    input: ImageLike,
    imageWidth?: number,
    imageHeight?: number,
    options?: DetectCoinTossOptions,
  ) => Promise<CoinTossScreen | null>;
  detectBadge: (input: ImageLike) => Promise<BadgeTurnOrder>;
}

interface UseTurnOrderCaptureLoopOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  captureCurrentFrame: () => boolean;
  dependencies?: Partial<TurnOrderCaptureLoopDependencies>;
}

export interface TurnOrderCaptureLoop {
  hasCoinTossFrame: boolean;
  coinTossDebug: CoinTossDebugInfo | null;
  turnOrderDetection: TurnOrderDetectionEvent | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
  restart: () => void;
  clearTurnOrderDetection: () => void;
  downloadFrame: () => void;
}

export function getOpponentSelectingFallbackTurnOrder(
  badgeOrder: BadgeTurnOrder,
): { order: TurnOrder; source: TurnOrderDetectionSource } {
  if (badgeOrder === 'first') return { order: 'third', source: 'in-duel-badge' };
  if (badgeOrder === 'second') return { order: 'second', source: 'in-duel-badge' };
  return { order: 'second', source: 'opponent-timeout' };
}

function canvasToImageLike(canvas: HTMLCanvasElement): ImageLike {
  return canvas as unknown as ImageLike;
}

const defaultDependencies = {
  createWorker: createJpnOcrWorker,
  detectCoinToss: detectCoinTossScreen,
  detectBadge: detectInDuelBadgeTurnOrderByImageFeatures,
};

export function useTurnOrderCaptureLoop({
  canvasRef,
  captureCurrentFrame,
  dependencies,
}: UseTurnOrderCaptureLoopOptions): TurnOrderCaptureLoop {
  const depsRef = useRef({ ...defaultDependencies, ...dependencies });

  const [hasCoinTossFrame, setHasCoinTossFrame] = useState(false);
  const [coinTossDebug, setCoinTossDebug] = useState<CoinTossDebugInfo | null>(null);
  const [turnOrderDetection, setTurnOrderDetection] = useState<TurnOrderDetectionEvent | null>(
    null,
  );

  const coinTossFrameRef = useRef<string | null>(null);
  const coinTossStateRef = useRef<CoinTossDetectionState>(INITIAL_COIN_TOSS_STATE);
  const turnOrderDetectedRef = useRef(false);
  const coinTossTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coinTossWorkerRef = useRef<Worker | null>(null);
  const coinTossRunningRef = useRef(false);
  const captureStartTimeRef = useRef(0);
  const firstCoinTossSeenAtRef = useRef<number | null>(null);
  const opponentSelectingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnOrderDetectionIdRef = useRef(0);
  const isActiveRef = useRef(false);
  const generationRef = useRef(0);
  const lastHitRoiRef = useRef<ROI | undefined>(undefined);
  const reusableOcrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    depsRef.current = { ...defaultDependencies, ...dependencies };
  }, [dependencies]);

  const clearTurnOrderDetection = useCallback(() => {
    setTurnOrderDetection(null);
  }, []);

  const resetFrame = useCallback(() => {
    coinTossFrameRef.current = null;
    setHasCoinTossFrame(false);
  }, []);

  const resetDebug = useCallback(() => {
    setCoinTossDebug(null);
  }, []);

  const stop = useCallback(() => {
    isActiveRef.current = false;
    generationRef.current += 1;
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

  const reset = useCallback(() => {
    stop();
    coinTossStateRef.current = INITIAL_COIN_TOSS_STATE;
    turnOrderDetectedRef.current = false;
    captureStartTimeRef.current = Date.now();
    firstCoinTossSeenAtRef.current = null;
    lastHitRoiRef.current = undefined;
    resetDebug();
    resetFrame();
    clearTurnOrderDetection();
  }, [clearTurnOrderDetection, resetDebug, resetFrame, stop]);

  const publishTurnOrderDetected = useCallback(
    (order: TurnOrder, source: TurnOrderDetectionSource) => {
      const event = {
        id: ++turnOrderDetectionIdRef.current,
        order,
        source,
        detectedAt: Date.now(),
      };
      setTurnOrderDetection(event);
    },
    [],
  );

  const detectOpponentSelectingFallback = useCallback(
    async (generation: number) => {
      if (
        generation !== generationRef.current ||
        turnOrderDetectedRef.current ||
        !coinTossStateRef.current.opponentSelectingDetected ||
        !isActiveRef.current
      ) {
        return;
      }

      const canvas = canvasRef.current;
      let badgeOrder: BadgeTurnOrder = null;
      try {
        badgeOrder =
          canvas && captureCurrentFrame()
            ? await depsRef.current.detectBadge(canvasToImageLike(canvas))
            : null;
      } catch {
        badgeOrder = null;
      }
      if (
        generation !== generationRef.current ||
        turnOrderDetectedRef.current ||
        !coinTossStateRef.current.opponentSelectingDetected ||
        !isActiveRef.current
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
      stop();
    },
    [canvasRef, captureCurrentFrame, publishTurnOrderDetected, stop],
  );

  const start = useCallback(() => {
    reset();
    isActiveRef.current = true;
    const generation = generationRef.current;

    const scheduleCoinTossOcr = () => {
      if (
        generation !== generationRef.current ||
        !isActiveRef.current ||
        turnOrderDetectedRef.current
      ) {
        return;
      }
      coinTossTimerRef.current = setTimeout(runCoinTossOcr, COIN_TOSS_INTERVAL_MS);
    };

    const runCoinTossOcr = async () => {
      if (
        generation !== generationRef.current ||
        !isActiveRef.current ||
        turnOrderDetectedRef.current ||
        coinTossRunningRef.current
      ) {
        return;
      }

      const elapsed = getElapsedMs(captureStartTimeRef.current);
      // 有効期限は最初のコイントス画面検出からカウントする。未検出（ロビー滞在中）の間は
      // 期限切れにせずポーリングを継続する。
      if (isCoinTossWindowExpired(firstCoinTossSeenAtRef.current, COIN_TOSS_ACTIVE_DURATION_MS)) {
        stop();
        return;
      }

      const worker = coinTossWorkerRef.current;
      const canvas = canvasRef.current;
      if (!worker || !canvas) return;

      recordTick('coin-toss-loop');
      coinTossRunningRef.current = true;
      if (!captureCurrentFrame()) {
        coinTossRunningRef.current = false;
        scheduleCoinTossOcr();
        return;
      }
      // デバッグ画像（PNG エンコード）は毎ティック走ると重い。captureDebug 有効時のみ生成する。
      // ダウンロードボタンは debug 有効時しか表示されないため、本番では取得不要。
      if (getCaptureDebugEnabled()) {
        const coinTossFrame = canvasToDataUrl(canvas);
        if (coinTossFrame) {
          coinTossFrameRef.current = coinTossFrame;
          setHasCoinTossFrame(true);
        }
      }
      try {
        const screen = await measureAsync('coin-toss-detect', () =>
          depsRef.current.detectCoinToss(
            worker,
            canvasToImageLike(canvas),
            canvas.width,
            canvas.height,
            {
              preferredRoi: lastHitRoiRef.current,
              onRoiHit: (roi) => {
                lastHitRoiRef.current = roi;
              },
              reusableCanvasRef: reusableOcrCanvasRef,
            },
          ),
        );
        if (generation !== generationRef.current || !isActiveRef.current) return;

        if (screen !== null && firstCoinTossSeenAtRef.current === null) {
          firstCoinTossSeenAtRef.current = Date.now();
        }

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

        if (newState.opponentSelectingDetected && !prevState.opponentSelectingDetected) {
          opponentSelectingTimeoutRef.current = setTimeout(() => {
            void detectOpponentSelectingFallback(generation);
          }, OPPONENT_SELECTING_TIMEOUT_MS);
        }

        if (newState.result && !turnOrderDetectedRef.current) {
          turnOrderDetectedRef.current = true;
          publishTurnOrderDetected(newState.result, 'coin-toss-ocr');
          stop();
          return;
        }
      } catch {
        // OCRエラーは無視して継続
      } finally {
        coinTossRunningRef.current = false;
      }

      scheduleCoinTossOcr();
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
      coinTossWorkerRef.current = worker;
      scheduleCoinTossOcr();
    })();
  }, [
    canvasRef,
    captureCurrentFrame,
    detectOpponentSelectingFallback,
    publishTurnOrderDetected,
    reset,
    stop,
  ]);

  const restart = useCallback(() => {
    start();
  }, [start]);

  const downloadFrame = useCallback(() => {
    const dataUrl = coinTossFrameRef.current;
    if (!dataUrl) return;
    downloadDataUrl(dataUrl, createCaptureFilename('coin-toss'));
  }, []);

  useEffect(() => stop, [stop]);

  return {
    hasCoinTossFrame,
    coinTossDebug,
    turnOrderDetection,
    start,
    stop,
    reset,
    restart,
    clearTurnOrderDetection,
    downloadFrame,
  };
}
