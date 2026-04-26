import { useCallback, useRef } from 'react';
import { detectFromImageLike } from './ocrDetect';
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

  const detect = useCallback(
    async (_canvas: HTMLCanvasElement, _roi: ROI): Promise<DetectionResult | null> => {
      if (runningRef.current) return null;
      runningRef.current = true;
      try {
        // フルキャンバスを 2 パス OCR に渡す（サイズを一緒に渡して ROI も自動適用）
        return await detectFromImageLike(
          _canvas as unknown as Blob,
          _canvas.width,
          _canvas.height,
        );
      } finally {
        runningRef.current = false;
      }
    },
    [],
  );

  return { detect };
}

// extractAndPreprocessROI は将来の高精度モードで利用可能
export { extractAndPreprocessROI };
