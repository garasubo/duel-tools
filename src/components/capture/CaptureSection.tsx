import { useDuelCapture } from '../../capture/useDuelCapture';

interface CaptureSectionProps {
  onResultDetected: (result: 'win' | 'loss') => void;
}

export default function CaptureSection({ onResultDetected }: CaptureSectionProps) {
  const {
    captureState,
    pendingResult,
    lastOcrResult,
    consecutiveCount,
    videoRef,
    canvasRef,
    error,
    start,
    stop,
    confirm,
    dismiss,
  } = useDuelCapture(onResultDetected);

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
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm text-gray-500">キャプチャ中</span>
          <button
            onClick={stop}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            停止
          </button>
        </div>
      )}

      {/* canvas は常にDOMに存在させる（isCapturing直後にrefが必要なため） */}
      <canvas
        ref={canvasRef}
        className={`border border-gray-200 rounded max-w-xs ${captureState === 'idle' ? 'hidden' : ''}`}
        style={{ maxHeight: '120px', objectFit: 'contain' }}
      />

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
              <span className="text-gray-400">{consecutiveCount}/3</span>
            </>
          )}
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

      {/* 非表示のビデオ要素 */}
      <video ref={videoRef} className="hidden" muted playsInline />
    </div>
  );
}
