import { useEffect, useState } from 'react';
import CaptureSection from '../components/capture/CaptureSection';
import BattleForm from '../components/battle-form/BattleForm';
import LastBattleQuickEdit from '../components/battle-form/LastBattleQuickEdit';
import { OverlayStatsPanel } from '../components/stats/OverlayStatsPanel';
import { useCaptureContext } from '../capture/useCaptureContext';
import { openOverlay } from '../utils/openOverlay';
import type { BattleResult } from '../types';

export default function RecordPage() {
  const [suggestedResult, setSuggestedResult] = useState<BattleResult | null>(null);
  const [suggestedPreviewResult, setSuggestedPreviewResult] = useState<BattleResult | null>(null);
  const {
    turnOrderDetection,
    clearTurnOrderDetection,
    restartTurnOrderDetection,
    prepareNextDuelDetection,
    setResultCallback,
    clearResultCallback,
    setResultPreviewCallback,
    clearResultPreviewCallback,
    setTurnOrderCallback,
    clearTurnOrderCallback,
  } = useCaptureContext();

  useEffect(() => {
    setResultCallback((result) => setSuggestedResult(result));
    setResultPreviewCallback((result) => setSuggestedPreviewResult(result));
    setTurnOrderCallback(() => {});
    return () => {
      clearResultCallback();
      clearResultPreviewCallback();
      clearTurnOrderCallback();
    };
  }, [setResultCallback, clearResultCallback, setResultPreviewCallback, clearResultPreviewCallback, setTurnOrderCallback, clearTurnOrderCallback]);

  return (
    <div>
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <OverlayStatsPanel variant="panel" />
          <button
            onClick={openOverlay}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors shrink-0 mt-1"
          >
            オーバーレイを開く
          </button>
        </div>
      </div>
      <CaptureSection />
      <LastBattleQuickEdit />
      <BattleForm
        suggestedResult={suggestedResult}
        onSuggestedResultConsumed={() => setSuggestedResult(null)}
        capturePreviewResult={suggestedPreviewResult}
        onCapturePreviewResultConsumed={() => setSuggestedPreviewResult(null)}
        suggestedTurnOrder={turnOrderDetection}
        onSuggestedTurnOrderConsumed={() => {
          clearTurnOrderDetection();
        }}
        onRecordSaved={prepareNextDuelDetection}
        onTurnOrderCleared={restartTurnOrderDetection}
      />
    </div>
  );
}
