import { useState } from 'react';
import { useCaptureContext } from '../../capture/useCaptureContext';
import Modal from '../ui/Modal';
import type { CaptureMemoShot } from './captureMemo';

interface CaptureMemoProps {
  shots: CaptureMemoShot[];
  onAdd: (dataUrl: string) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

export default function CaptureMemo({ shots, onAdd, onRemove, onClearAll }: CaptureMemoProps) {
  const { isCapturing, captureCurrentFrameDataUrl } = useCaptureContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedShot = shots.find((shot) => shot.id === selectedId) ?? null;

  const handleCapture = () => {
    const dataUrl = captureCurrentFrameDataUrl();
    if (!dataUrl) return;
    onAdd(dataUrl);
  };

  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleCapture}
          disabled={!isCapturing}
          className="text-sm px-3 py-1.5 rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          スクリーンショットを撮る
        </button>
        {shots.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            すべて消去
          </button>
        )}
      </div>

      {shots.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {shots.map((shot) => (
            <div key={shot.id} className="relative group">
              <button
                type="button"
                onClick={() => setSelectedId(shot.id)}
                className="block rounded-md overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors"
              >
                <img
                  src={shot.dataUrl}
                  alt="対戦メモ"
                  className="w-32 h-auto block"
                />
              </button>
              <button
                type="button"
                onClick={() => onRemove(shot.id)}
                aria-label="削除"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-gray-700 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={selectedShot !== null}
        onClose={() => setSelectedId(null)}
        title="対戦メモ"
        className="w-[90vw]! max-w-[90vw]!"
      >
        {selectedShot && (
          <img src={selectedShot.dataUrl} alt="対戦メモ" className="w-full h-auto" />
        )}
      </Modal>
    </div>
  );
}
