import { useCaptureContext } from '../../capture/useCaptureContext';

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
    coinTossDebug,
    downloadCurrentFrame,
    downloadFirstCandidateFrame,
    start,
    stop,
    confirm,
    dismiss,
  } = useCaptureContext();

  return (
    <div className="px-4 pb-2">
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

      {captureState === 'capturing' && (
        <div className="flex items-center gap-2 text-sm mt-1">
          {lastOcrResult === null ? (
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

      {captureState === 'waiting-clear' && (
        <div className="flex items-center gap-2 text-sm mt-1">
          <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
          <span className="text-gray-400">
            {pendingResult && autoConfirmEnabled
              ? '自動確定のため結果画面の終了待ち...'
              : '結果画面の終了待ち...'}
          </span>
        </div>
      )}

      {captureState === 'detected' && pendingResult && (
        <div
          className={`mt-2 p-3 rounded-lg flex items-center gap-4 ${
            pendingResult.result === 'win'
              ? 'bg-blue-50 border border-blue-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <span
            className={`font-bold text-lg ${
              pendingResult.result === 'win' ? 'text-blue-700' : 'text-red-700'
            }`}
          >
            {pendingResult.result === 'win' ? 'VICTORY 検出' : 'LOSE 検出'}
          </span>
          <span className="text-xs text-gray-400">
            信頼度: {Math.round(pendingResult.confidence)}%
          </span>
          <button
            onClick={confirm}
            className="ml-auto text-sm px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            確定
          </button>
          <button
            onClick={dismiss}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            却下
          </button>
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
          </div>
          <div className="text-xs text-gray-500 font-mono break-all">
            Coin: screen={coinTossDebug?.screen ?? 'null'} / opponent=
            {coinTossDebug?.opponentSelectingDetected ? 'true' : 'false'} / result=
            {coinTossDebug?.result ?? 'null'} / elapsed=
            {coinTossDebug ? `${coinTossDebug.elapsedMs}ms` : '-'} / updated=
            {coinTossDebug ? new Date(coinTossDebug.updatedAt).toLocaleTimeString() : '-'}
          </div>
        </div>
      )}
    </div>
  );
}
