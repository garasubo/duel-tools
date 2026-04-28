import { useCallback, useRef } from 'react';
import type { Worker } from 'tesseract.js';
import { createOcrWorker, detectWithOcrWorker } from './ocrDetect';
import type { DetectionResult, ROI } from './types';

function extractAndPreprocessROI(src: HTMLCanvasElement, roi: ROI): HTMLCanvasElement {
  const x = Math.floor(roi.x * src.width);
  const y = Math.floor(roi.y * src.height);
  const w = Math.floor(roi.width * src.width);
  const h = Math.floor(roi.height * src.height);

  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const ctx = offscreen.getContext('2d')!;
  ctx.drawImage(src, x, y, w, h, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const v = gray > 128 ? 255 : 0;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
  return offscreen;
}

export function useOcrDetector() {
  const runningRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);
  const workerInitPromiseRef = useRef<Promise<Worker> | null>(null);
  const disposeGenerationRef = useRef(0);

  const getWorker = useCallback(async () => {
    if (workerRef.current) return workerRef.current;
    if (!workerInitPromiseRef.current) {
      const generation = disposeGenerationRef.current;
      workerInitPromiseRef.current = createOcrWorker().then(async (worker) => {
        if (generation !== disposeGenerationRef.current) {
          await worker.terminate();
          throw new Error('OCR worker initialization was disposed');
        }
        workerRef.current = worker;
        return worker;
      }).finally(() => {
        workerInitPromiseRef.current = null;
      });
    }
    return workerInitPromiseRef.current;
  }, []);

  const detect = useCallback(
    async (_canvas: HTMLCanvasElement, _roi: ROI): Promise<DetectionResult | null> => {
      if (runningRef.current) return null;
      runningRef.current = true;
      try {
        void _roi;
        const worker = await getWorker();
        // フルキャンバスを 2 パス OCR に渡す（サイズを一緒に渡して ROI も自動適用）
        return await detectWithOcrWorker(
          worker,
          _canvas as unknown as Blob,
          _canvas.width,
          _canvas.height,
        );
      } catch (error) {
        if (error instanceof Error && error.message === 'OCR worker initialization was disposed') {
          return null;
        }
        throw error;
      } finally {
        runningRef.current = false;
      }
    },
    [getWorker],
  );

  // 指定ROIの生テキストを返す（デュエル中ターン判定フォールバック用）
  const detectRawText = useCallback(
    async (canvas: HTMLCanvasElement, roi: ROI): Promise<string | null> => {
      if (runningRef.current) return null;
      runningRef.current = true;
      try {
        const worker = await getWorker();
        const rect = {
          left: Math.floor(roi.x * canvas.width),
          top: Math.floor(roi.y * canvas.height),
          width: Math.floor(roi.width * canvas.width),
          height: Math.floor(roi.height * canvas.height),
        };
        const { data } = await worker.recognize(canvas as unknown as Blob, { rectangle: rect });
        return data.text;
      } catch (error) {
        if (error instanceof Error && error.message === 'OCR worker initialization was disposed') {
          return null;
        }
        throw error;
      } finally {
        runningRef.current = false;
      }
    },
    [getWorker],
  );

  const dispose = useCallback(() => {
    disposeGenerationRef.current += 1;
    const worker = workerRef.current;
    workerRef.current = null;

    if (worker) {
      void worker.terminate();
    }
  }, []);

  return { detect, detectRawText, dispose };
}

// extractAndPreprocessROI は将来の高精度モードで利用可能
export { extractAndPreprocessROI };
