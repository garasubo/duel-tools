import { useCallback, useEffect, useRef, useState } from 'react';

// MediaRecorder に渡す mimeType 候補。VP9 → VP8 → 既定 webm の順に対応可否を見る。
const PREFERRED_MIME_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * getDisplayMedia で取得した画面ストリームを MediaRecorder で録画し、
 * 停止時に webm の Blob を返す薄いフック。
 * `useScreenCapture` と同じく getDisplayMedia の取得・トラック `'ended'` 監視・
 * 後始末のパターンを踏襲する（音声は録画しない）。
 */
export function useCaptureRecorder() {
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanupStream = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      cleanupStream();
      setIsRecording(false);
      return Promise.resolve(null);
    }

    return new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'video/webm';
        const chunks = chunksRef.current;
        chunksRef.current = [];
        recorderRef.current = null;
        cleanupStream();
        setIsRecording(false);
        resolve(chunks.length > 0 ? new Blob(chunks, { type: mimeType }) : null);
      };
      recorder.stop();
    });
  }, [cleanupStream]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      if (typeof MediaRecorder === 'undefined') {
        setError('このブラウザは MediaRecorder に対応していません');
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      streamRef.current = stream;
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
        await previewVideoRef.current.play().catch(() => {
          // 自動再生が拒否されても録画自体は継続できるため無視する
        });
      }

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorderRef.current = recorder;
      recorder.start();

      // ユーザーがブラウザ側で共有を停止した場合は録画も止める。
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        void stopRecording();
      });

      setIsRecording(true);
    } catch (err) {
      cleanupStream();
      setError(err instanceof Error ? err.message : '画面キャプチャの録画を開始できませんでした');
    }
  }, [cleanupStream, stopRecording]);

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      recorderRef.current = null;
      chunksRef.current = [];
      cleanupStream();
    };
  }, [cleanupStream]);

  return { previewVideoRef, isRecording, error, startRecording, stopRecording };
}
