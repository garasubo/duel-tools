import { useCallback, useRef } from 'react';

export function useFrameSampler(interval = 750) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(
    (video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
      if (timerRef.current !== null) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      timerRef.current = setInterval(() => {
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
      }, interval);
    },
    [interval],
  );

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { start, stop };
}
