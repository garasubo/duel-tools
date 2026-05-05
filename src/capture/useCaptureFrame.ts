import { useCallback } from 'react';
import type { RefObject } from 'react';

const HAVE_CURRENT_DATA = 2;

export function captureFrame(
  video: HTMLVideoElement | null,
  canvas: HTMLCanvasElement | null,
): boolean {
  if (!video || !canvas) return false;
  if (video.readyState < HAVE_CURRENT_DATA) return false;
  if (video.videoWidth === 0 || video.videoHeight === 0) return false;

  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  return true;
}

export function useCaptureFrame(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
) {
  const captureCurrentFrame = useCallback(
    () => captureFrame(videoRef.current, canvasRef.current),
    [canvasRef, videoRef],
  );

  return { captureCurrentFrame };
}
