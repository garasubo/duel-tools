import { useCallback, useRef, useState } from 'react';

export function useScreenCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCapture = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // キャプチャが止まったとき（ユーザーが共有を停止した場合）
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopCapture();
      });
      setIsCapturing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '画面キャプチャを開始できませんでした');
    }
  }, []);

  const stopCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCapturing(false);
  }, []);

  return { videoRef, isCapturing, error, startCapture, stopCapture };
}
