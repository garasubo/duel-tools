import { useCallback, useEffect, useState } from 'react';
import CaptureSection from '../components/capture/CaptureSection';
import CaptureMemo from '../components/capture/CaptureMemo';
import { createMemoShot, removeMemoShot } from '../components/capture/captureMemo';
import type { CaptureMemoShot } from '../components/capture/captureMemo';
import BattleForm from '../components/battle-form/BattleForm';
import LastBattleQuickEdit from '../components/battle-form/LastBattleQuickEdit';
import { OverlayStatsPanel } from '../components/stats/OverlayStatsPanel';
import { useCaptureContext } from '../capture/useCaptureContext';
import { useBattlesStore } from '../state/BattlesProvider';
import { openOverlay } from '../utils/openOverlay';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { BattleResult } from '../types';

export default function RecordPage() {
  useDocumentTitle('戦績記録 | 遊戯王の対戦履歴・勝率管理ツール - duel-tools');
  const [suggestedResult, setSuggestedResult] = useState<BattleResult | null>(null);
  const [suggestedPreviewResult, setSuggestedPreviewResult] = useState<BattleResult | null>(null);
  const [suggestedScore, setSuggestedScore] = useState<number | null>(null);
  const [ratingConfirmToken, setRatingConfirmToken] = useState(0);
  const store = useBattlesStore();
  const [memoShots, setMemoShots] = useState<CaptureMemoShot[]>(() =>
    store.getDraftMemoShots(),
  );
  const {
    turnOrderDetection,
    clearTurnOrderDetection,
    restartTurnOrderDetection,
    prepareNextDuelDetection,
    subscribeCaptureEvents,
  } = useCaptureContext();

  useEffect(
    () =>
      subscribeCaptureEvents((event) => {
        switch (event.type) {
          case 'result':
            setSuggestedResult(event.result);
            break;
          case 'result-preview':
            setSuggestedPreviewResult(event.result);
            break;
          case 'rating':
            setSuggestedScore(event.rating);
            break;
          case 'rating-confirmed':
            setRatingConfirmToken((token) => token + 1);
            break;
        }
      }),
    [subscribeCaptureEvents],
  );

  // タブ移動で RecordPage が再マウントされてもメモ画像を失わないよう、
  // 共有ストアのメモリ上スタッシュへ退避する。
  useEffect(() => {
    store.setDraftMemoShots(memoShots);
  }, [memoShots, store]);

  const handleSuggestedResultConsumed = useCallback(() => setSuggestedResult(null), []);
  const handleCapturePreviewResultConsumed = useCallback(
    () => setSuggestedPreviewResult(null),
    [],
  );
  const handleSuggestedTurnOrderConsumed = useCallback(() => {
    clearTurnOrderDetection();
  }, [clearTurnOrderDetection]);

  const handleSuggestedScoreConsumed = useCallback(() => setSuggestedScore(null), []);

  const handleAddMemo = useCallback(
    (dataUrl: string) => setMemoShots((prev) => [...prev, createMemoShot(dataUrl, Date.now())]),
    [],
  );
  const handleRemoveMemo = useCallback(
    (id: string) => setMemoShots((prev) => removeMemoShot(prev, id)),
    [],
  );
  const handleClearMemos = useCallback(() => setMemoShots([]), []);

  const handleRecordSaved = useCallback(() => {
    prepareNextDuelDetection();
    setMemoShots([]);
  }, [prepareNextDuelDetection]);

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
      <CaptureMemo
        shots={memoShots}
        onAdd={handleAddMemo}
        onRemove={handleRemoveMemo}
        onClearAll={handleClearMemos}
      />
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
        onRecordSaved={handleRecordSaved}
        onTurnOrderCleared={restartTurnOrderDetection}
      />
    </div>
  );
}
