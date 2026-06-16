import { useEffect, useState } from 'react';
import { useCaptureContext } from '../../capture/useCaptureContext';
import {
  getProfileSnapshot,
  getTickFpsSnapshot,
} from '../../capture/captureProfiler';
import type { ProfileStat, TickFps } from '../../capture/captureProfiler';

interface ProfilerSnapshot {
  stats: ProfileStat[];
  fps: TickFps[];
}

const EMPTY_SNAPSHOT: ProfilerSnapshot = { stats: [], fps: [] };

// captureDebug 有効時、プロファイラの集計を 500ms 間隔でポーリングして表示用に取り込む。
function useProfilerSnapshot(active: boolean): ProfilerSnapshot {
  const [snapshot, setSnapshot] = useState<ProfilerSnapshot>(EMPTY_SNAPSHOT);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setSnapshot({ stats: getProfileSnapshot(), fps: getTickFpsSnapshot() });
    }, 500);
    return () => clearInterval(id);
  }, [active]);

  return active ? snapshot : EMPTY_SNAPSHOT;
}

export default function CaptureSection() {
  const {
    captureState,
    pendingResult,
    lastOcrResult,
    consecutiveCount,
    requiredConsecutiveCount,
    error,
    autoConfirmEnabled,
    setAutoConfirmEnabled,
    isCaptureDebugEnabled,
    hasFirstCandidateFrame,
    hasCoinTossFrame,
    hasRatingFrame,
    coinTossDebug,
    turnOrderDetection,
    ratingDetection,
    downloadCurrentFrame,
    downloadFirstCandidateFrame,
    downloadCoinTossFrame,
    downloadRatingFrame,
    start,
    stop,
  } = useCaptureContext();

  const { stats: profileStats, fps: profileFps } = useProfilerSnapshot(
    isCaptureDebugEnabled && captureState !== 'idle',
  );

  const statusResult = pendingResult?.result ?? lastOcrResult;
  const statusLabel = statusResult === 'win' ? 'VICTORY' : 'LOSE';

  return (
    <div className="px-4 py-2">
      {captureState === 'idle' && (
        <button
          onClick={start}
          className="text-sm px-3 py-1.5 rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"
        >
          キャプチャ開始
        </button>
      )}

      {captureState !== 'idle' && (
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="text-sm text-gray-500">キャプチャ中</span>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoConfirmEnabled}
              onChange={(e) => setAutoConfirmEnabled(e.target.checked)}
              className="h-4 w-4 accent-blue-600"
            />
            自動確定
          </label>
          <button
            onClick={stop}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            停止
          </button>
        </div>
      )}

      {(captureState === 'capturing' ||
        captureState === 'detected' ||
        captureState === 'waiting-rating') && (
        <div className="flex items-center gap-2 text-sm mt-1">
          {captureState === 'waiting-rating' ? (
            ratingDetection ? (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                <span className="text-green-600">検出レート: {ratingDetection.rating}</span>
              </>
            ) : (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
                <span className="text-gray-400">レートをスキャン中...</span>
              </>
            )
          ) : captureState === 'detected' && pendingResult ? (
            <>
              <span
                className={`inline-block w-2 h-2 rounded-full ${pendingResult.result === 'win' ? 'bg-blue-500' : 'bg-red-500'}`}
              />
              <span className={pendingResult.result === 'win' ? 'text-blue-600' : 'text-red-600'}>
                {statusLabel} 検出済み
              </span>
              <span className="text-gray-400">フォームに反映済み</span>
            </>
          ) : lastOcrResult === null ? (
            <>
              <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
              <span className="text-gray-400">スキャン中...</span>
            </>
          ) : (
            <>
              <span
                className={`inline-block w-2 h-2 rounded-full ${lastOcrResult === 'win' ? 'bg-blue-500' : 'bg-red-500'}`}
              />
              <span className={lastOcrResult === 'win' ? 'text-blue-600' : 'text-red-600'}>
                {lastOcrResult === 'win' ? 'VICTORY' : 'LOSE'} 検出中
              </span>
              <span className="text-gray-400">
                {consecutiveCount}/{requiredConsecutiveCount}
              </span>
            </>
          )}
        </div>
      )}

      {captureState === 'waiting-clear' && autoConfirmEnabled && (
        <div className="flex items-center gap-2 text-sm mt-1">
          <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
          <span className="text-gray-400">自動確定のため結果画面の終了待ち...</span>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 mt-1">{error}</p>
      )}

      {isCaptureDebugEnabled && (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={downloadCurrentFrame}
              className="text-xs px-2.5 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              現在フレームを保存
            </button>
            <button
              type="button"
              onClick={downloadFirstCandidateFrame}
              disabled={!hasFirstCandidateFrame}
              className="text-xs px-2.5 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              初回候補を保存
            </button>
            <button
              type="button"
              onClick={downloadCoinTossFrame}
              disabled={!hasCoinTossFrame}
              className="text-xs px-2.5 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              コイントス判定画像を保存
            </button>
            <button
              type="button"
              onClick={downloadRatingFrame}
              disabled={!hasRatingFrame}
              className="text-xs px-2.5 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              レート検出画像を保存
            </button>
          </div>
          <div className="text-xs text-gray-500 font-mono break-all">
            Coin: screen={coinTossDebug?.screen ?? 'null'} / opponent=
            {coinTossDebug?.opponentSelectingDetected ? 'true' : 'false'} / result=
            {coinTossDebug?.result ?? 'null'} / elapsed=
            {coinTossDebug ? `${coinTossDebug.elapsedMs}ms` : '-'} / updated=
            {coinTossDebug ? new Date(coinTossDebug.updatedAt).toLocaleTimeString() : '-'} / accepted=
            {turnOrderDetection
              ? `${turnOrderDetection.order}:${turnOrderDetection.source}#${turnOrderDetection.id}`
              : 'null'}
          </div>
          {(profileStats.length > 0 || profileFps.length > 0) && (
            <div className="text-xs text-gray-500 font-mono">
              <div className="font-semibold text-gray-600">Profiler</div>
              {profileFps.map((f) => (
                <div key={f.label}>
                  {f.label}: {f.fps.toFixed(1)} fps
                </div>
              ))}
              {profileStats.map((s) => (
                <div key={s.label}>
                  {s.label}: avg {s.avgMs.toFixed(1)}ms / max {s.maxMs.toFixed(1)}ms / last{' '}
                  {s.lastMs.toFixed(1)}ms (n={s.count})
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
