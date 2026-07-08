import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Worker } from 'tesseract.js';
import {
  createOcrWorker,
  detectWithOcrWorker,
} from '../capture/ocrDetect';
import { createJpnOcrWorker, detectCoinTossScreen } from '../capture/coinTossDetect';
import { createRatingOcrWorker, detectRatingFromScreen } from '../capture/ratingDetect';
import { createDpOcrWorker, detectDpFromScreen } from '../capture/dpDetect';
import { captureFrame } from '../capture/useCaptureFrame';
import { useCaptureRecorder } from '../capture/useCaptureRecorder';
import type { DetectionResult } from '../capture/types';
import type { CoinTossScreen } from '../capture/coinTossDetect';

type ReplayDetector = 'result' | 'coin' | 'rating' | 'dp' | 'all';

interface ReplayLogEntry {
  id: number;
  atMs: number;
  detector: Exclude<ReplayDetector, 'all'>;
  value: string;
  elapsedMs: number;
}

interface ReplayWorkers {
  result: Worker | null;
  coin: Worker | null;
  rating: Worker | null;
  dp: Worker | null;
}

const EMPTY_WORKERS: ReplayWorkers = {
  result: null,
  coin: null,
  rating: null,
  dp: null,
};

function formatTime(ms: number): string {
  if (!Number.isFinite(ms)) return '00:00.000';
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.max(0, Math.floor(ms % 1000));
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function formatResult(result: DetectionResult | null): string {
  if (!result) return 'null';
  return `${result.result} (${Math.round(result.confidence)}%)`;
}

function formatNullable(value: number | CoinTossScreen | null): string {
  return value === null ? 'null' : String(value);
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export default function CaptureReplayPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workersRef = useRef<ReplayWorkers>(EMPTY_WORKERS);
  const coinReusableCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ratingReusableCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dpReusableCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const logIdRef = useRef(0);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [canDownload, setCanDownload] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ReplayLogEntry[]>([]);

  const {
    previewVideoRef,
    isRecording,
    error: recorderError,
    startRecording,
    stopRecording,
  } = useCaptureRecorder();

  const canScan = videoUrl !== null && !isBusy && !isRecording;
  const timelineMax = Math.max(1, Math.floor(durationMs));

  const terminateWorkers = useCallback(async () => {
    const workers = workersRef.current;
    workersRef.current = EMPTY_WORKERS;
    await Promise.all(
      Object.values(workers)
        .filter((worker): worker is Worker => worker !== null)
        .map((worker) => worker.terminate()),
    );
  }, []);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      void terminateWorkers();
    };
  }, [terminateWorkers, videoUrl]);

  const ensureWorker = useCallback(async (detector: Exclude<ReplayDetector, 'all'>) => {
    const workers = workersRef.current;
    if (workers[detector]) return workers[detector];

    const worker =
      detector === 'result'
        ? await createOcrWorker()
        : detector === 'coin'
          ? await createJpnOcrWorker()
          : detector === 'rating'
            ? await createRatingOcrWorker()
            : await createDpOcrWorker();
    workersRef.current = { ...workersRef.current, [detector]: worker };
    return worker;
  }, []);

  const drawCurrentFrame = useCallback((): HTMLCanvasElement | null => {
    const ok = captureFrame(videoRef.current, canvasRef.current);
    return ok ? canvasRef.current : null;
  }, []);

  const addLog = useCallback(
    (entry: Omit<ReplayLogEntry, 'id'>) => {
      logIdRef.current += 1;
      setLogs((current) => [{ ...entry, id: logIdRef.current }, ...current].slice(0, 120));
    },
    [],
  );

  const runDetector = useCallback(
    async (detector: Exclude<ReplayDetector, 'all'>) => {
      const canvas = drawCurrentFrame();
      if (!canvas) throw new Error('現在フレームを取得できませんでした');

      const startedAt = performance.now();
      const worker = await ensureWorker(detector);
      let value: string;

      if (detector === 'result') {
        value = formatResult(await detectWithOcrWorker(worker, canvas, canvas.width, canvas.height));
      } else if (detector === 'coin') {
        value = formatNullable(
          await detectCoinTossScreen(worker, canvas, canvas.width, canvas.height, {
            reusableCanvasRef: coinReusableCanvasRef,
          }),
        );
      } else if (detector === 'rating') {
        value = formatNullable(await detectRatingFromScreen(worker, canvas, ratingReusableCanvasRef));
      } else {
        value = formatNullable(await detectDpFromScreen(worker, canvas, dpReusableCanvasRef));
      }

      addLog({
        atMs: videoRef.current ? videoRef.current.currentTime * 1000 : currentMs,
        detector,
        value,
        elapsedMs: performance.now() - startedAt,
      });
    },
    [addLog, currentMs, drawCurrentFrame, ensureWorker],
  );

  const runScan = useCallback(
    async (detector: ReplayDetector) => {
      if (!canScan) return;
      setIsBusy(true);
      setError(null);
      try {
        if (detector === 'all') {
          await runDetector('result');
          await runDetector('coin');
          await runDetector('rating');
          await runDetector('dp');
        } else {
          await runDetector(detector);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '検出に失敗しました');
      } finally {
        setIsBusy(false);
      }
    },
    [canScan, runDetector],
  );

  const loadVideoBlob = useCallback(
    (blob: Blob, name: string, options?: { downloadable?: boolean }) => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      void terminateWorkers();
      const nextUrl = URL.createObjectURL(blob);
      setVideoUrl(nextUrl);
      setVideoName(name);
      setCanDownload(options?.downloadable ?? false);
      setCurrentMs(0);
      setDurationMs(0);
      setLogs([]);
      setError(null);
      logIdRef.current = 0;
    },
    [terminateWorkers, videoUrl],
  );

  const handleVideoFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      loadVideoBlob(file, file.name);
    },
    [loadVideoBlob],
  );

  const handleStopRecording = useCallback(async () => {
    const blob = await stopRecording();
    if (!blob) {
      setError('録画データを取得できませんでした');
      return;
    }
    loadVideoBlob(blob, `capture-${formatTimestamp(new Date())}.webm`, { downloadable: true });
  }, [loadVideoBlob, stopRecording]);

  const downloadVideo = useCallback(() => {
    if (!videoUrl || !canDownload) return;
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = videoName ?? `capture-${formatTimestamp(new Date())}.webm`;
    link.click();
  }, [canDownload, videoName, videoUrl]);

  const seekToMs = useCallback(
    (ms: number) => {
      const video = videoRef.current;
      if (!video) return;
      const clampedMs = Math.min(Math.max(0, ms), durationMs || ms);
      video.currentTime = clampedMs / 1000;
      setCurrentMs(clampedMs);
    },
    [durationMs],
  );

  const stepFrame = useCallback(
    (direction: 1 | -1) => {
      const stepMs = 1000 / 30;
      seekToMs(currentMs + direction * stepMs);
    },
    [currentMs, seekToMs],
  );

  const downloadFrame = useCallback(() => {
    const canvas = drawCurrentFrame();
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `capture-replay-${Math.round(currentMs)}ms.png`;
    link.click();
  }, [currentMs, drawCurrentFrame]);

  const latestSummary = useMemo(() => {
    const byDetector = new Map<ReplayLogEntry['detector'], ReplayLogEntry>();
    for (const log of logs) {
      if (!byDetector.has(log.detector)) byDetector.set(log.detector, log);
    }
    return byDetector;
  }, [logs]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-5">
        <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-cyan-300">debug only</p>
            <h1 className="text-2xl font-semibold">Capture Replay</h1>
            {recorderError && <p className="mt-1 text-xs text-red-300">{recorderError}</p>}
          </div>
          <div className="flex w-fit flex-wrap items-center gap-2">
            {isRecording ? (
              <button
                type="button"
                onClick={() => void handleStopRecording()}
                className="inline-flex items-center gap-2 rounded-md border border-red-500 bg-red-500/10 px-3 py-2 text-sm text-red-200 hover:bg-red-500/20"
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                録画停止
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void startRecording()}
                className="inline-flex items-center gap-2 rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800"
              >
                キャプチャ録画開始
              </button>
            )}
            <label
              className={`inline-flex w-fit items-center gap-2 rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-100 ${
                isRecording ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-slate-800'
              }`}
            >
              <span>動画を選択</span>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                disabled={isRecording}
                onChange={(event) => handleVideoFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            <div className="overflow-hidden rounded-md border border-slate-700 bg-black">
              {/* 録画中プレビュー: ref を常設し、startRecording 時に srcObject を張れるようにする */}
              <video
                ref={previewVideoRef}
                muted
                autoPlay
                playsInline
                className={`aspect-video w-full bg-black ${isRecording ? '' : 'hidden'}`}
              />
              {!isRecording &&
                (videoUrl ? (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    playsInline
                    className="aspect-video w-full bg-black"
                    onLoadedMetadata={(event) => {
                      setDurationMs(event.currentTarget.duration * 1000);
                      drawCurrentFrame();
                    }}
                    onTimeUpdate={(event) => setCurrentMs(event.currentTarget.currentTime * 1000)}
                    onPlay={() => setIsRunning(true)}
                    onPause={() => {
                      setIsRunning(false);
                      drawCurrentFrame();
                    }}
                    onSeeked={() => drawCurrentFrame()}
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center text-sm text-slate-500">
                    動画ファイルを選択、またはキャプチャ録画で作成してください
                  </div>
                ))}
            </div>

            <div className="grid gap-3 rounded-md border border-slate-700 bg-slate-900 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!videoUrl || isRecording}
                  onClick={() => (isRunning ? videoRef.current?.pause() : void videoRef.current?.play())}
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isRunning ? '一時停止' : '再生'}
                </button>
                <button
                  type="button"
                  disabled={!videoUrl || isRecording}
                  onClick={() => stepFrame(-1)}
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  -1 frame
                </button>
                <button
                  type="button"
                  disabled={!videoUrl || isRecording}
                  onClick={() => stepFrame(1)}
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +1 frame
                </button>
                <button
                  type="button"
                  disabled={!videoUrl || isRecording}
                  onClick={downloadFrame}
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  フレーム保存
                </button>
                {canDownload && (
                  <button
                    type="button"
                    disabled={!videoUrl || isRecording}
                    onClick={downloadVideo}
                    className="rounded-md border border-cyan-600 px-3 py-1.5 text-sm text-cyan-100 hover:bg-cyan-900/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    動画をDL
                  </button>
                )}
                <span className="ml-auto font-mono text-sm text-slate-300">
                  {formatTime(currentMs)} / {formatTime(durationMs)}
                </span>
              </div>

              <input
                type="range"
                min={0}
                max={timelineMax}
                step={1}
                value={Math.min(Math.floor(currentMs), timelineMax)}
                disabled={!videoUrl || isRecording}
                onChange={(event) => seekToMs(Number(event.target.value))}
                className="w-full accent-cyan-400 disabled:opacity-40"
              />
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </div>

          <aside className="space-y-3">
            <div className="rounded-md border border-slate-700 bg-slate-900 p-3">
              <div className="mb-2 text-sm font-semibold text-slate-200">検出</div>
              <div className="grid grid-cols-2 gap-2">
                {(['result', 'coin', 'rating', 'dp', 'all'] as ReplayDetector[]).map((detector) => (
                  <button
                    key={detector}
                    type="button"
                    disabled={!canScan}
                    onClick={() => void runScan(detector)}
                    className="rounded-md border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {detector}
                  </button>
                ))}
              </div>
              {isBusy && <p className="mt-2 text-xs text-cyan-300">OCR 実行中...</p>}
              {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
              <div className="mt-3 border-t border-slate-700 pt-3 text-xs text-slate-300">
                <div>file: {videoName ?? '-'}</div>
                <div>result: {latestSummary.get('result')?.value ?? '-'}</div>
                <div>coin: {latestSummary.get('coin')?.value ?? '-'}</div>
                <div>rating: {latestSummary.get('rating')?.value ?? '-'}</div>
                <div>dp: {latestSummary.get('dp')?.value ?? '-'}</div>
              </div>
            </div>

            <div className="rounded-md border border-slate-700 bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
                <div className="text-sm font-semibold text-slate-200">ログ</div>
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  className="text-xs text-slate-400 hover:text-slate-100"
                >
                  clear
                </button>
              </div>
              <div className="max-h-[460px] overflow-auto">
                {logs.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-slate-500">まだログはありません</div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-900 text-slate-400">
                      <tr>
                        <th className="px-3 py-2 font-medium">time</th>
                        <th className="px-3 py-2 font-medium">type</th>
                        <th className="px-3 py-2 font-medium">value</th>
                        <th className="px-3 py-2 text-right font-medium">ms</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-t border-slate-800">
                          <td className="px-3 py-2 font-mono text-slate-300">{formatTime(log.atMs)}</td>
                          <td className="px-3 py-2 text-slate-300">{log.detector}</td>
                          <td className="px-3 py-2 font-mono text-slate-100">{log.value}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-400">
                            {log.elapsedMs.toFixed(0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
