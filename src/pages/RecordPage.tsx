import { useCallback, useEffect, useState } from 'react';
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
  const [suggestedScore, setSuggestedScore] = useState<number | null>(null);
  const [ratingConfirmToken, setRatingConfirmToken] = useState(0);
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
    setRatingCallback,
    clearRatingCallback,
    setRatingConfirmCallback,
    clearRatingConfirmCallback,
  } = useCaptureContext();

  useEffect(() => {
    setResultCallback((result) => setSuggestedResult(result));
    setResultPreviewCallback((result) => setSuggestedPreviewResult(result));
    setTurnOrderCallback(() => {});
    setRatingCallback((rating) => setSuggestedScore(rating));
    setRatingConfirmCallback(() => setRatingConfirmToken((token) => token + 1));
    return () => {
      clearResultCallback();
      clearResultPreviewCallback();
      clearTurnOrderCallback();
      clearRatingCallback();
      clearRatingConfirmCallback();
    };
  }, [setResultCallback, clearResultCallback, setResultPreviewCallback, clearResultPreviewCallback, setTurnOrderCallback, clearTurnOrderCallback, setRatingCallback, clearRatingCallback, setRatingConfirmCallback, clearRatingConfirmCallback]);

  const handleSuggestedResultConsumed = useCallback(() => setSuggestedResult(null), []);
  const handleCapturePreviewResultConsumed = useCallback(
    () => setSuggestedPreviewResult(null),
    [],
  );
  const handleSuggestedTurnOrderConsumed = useCallback(() => {
    clearTurnOrderDetection();
  }, [clearTurnOrderDetection]);

  const handleSuggestedScoreConsumed = useCallback(() => setSuggestedScore(null), []);

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
        onSuggestedResultConsumed={handleSuggestedResultConsumed}
        capturePreviewResult={suggestedPreviewResult}
        onCapturePreviewResultConsumed={handleCapturePreviewResultConsumed}
        suggestedTurnOrder={turnOrderDetection}
        onSuggestedTurnOrderConsumed={handleSuggestedTurnOrderConsumed}
        suggestedScore={suggestedScore}
        onSuggestedScoreConsumed={handleSuggestedScoreConsumed}
        ratingConfirmToken={ratingConfirmToken}
        onRecordSaved={prepareNextDuelDetection}
        onTurnOrderCleared={restartTurnOrderDetection}
      />
    </div>
  );
}
