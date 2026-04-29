import { useEffect, useState } from 'react';
import CaptureSection from '../components/capture/CaptureSection';
import BattleForm from '../components/battle-form/BattleForm';
import LastBattleQuickEdit from '../components/battle-form/LastBattleQuickEdit';
import { useCaptureContext } from '../capture/useCaptureContext';
import { openOverlay } from '../utils/openOverlay';
import type { BattleResult, TurnOrder } from '../types';

export default function RecordPage() {
  const [suggestedResult, setSuggestedResult] = useState<BattleResult | null>(null);
  const [suggestedTurnOrder, setSuggestedTurnOrder] = useState<TurnOrder | null>(null);
  const { setResultCallback, clearResultCallback, setTurnOrderCallback, clearTurnOrderCallback } = useCaptureContext();

  useEffect(() => {
    setResultCallback((result) => setSuggestedResult(result));
    setTurnOrderCallback((order) => setSuggestedTurnOrder(order));
    return () => {
      clearResultCallback();
      clearTurnOrderCallback();
    };
  }, [setResultCallback, clearResultCallback, setTurnOrderCallback, clearTurnOrderCallback]);

  return (
    <div>
      <div className="flex justify-end px-4 pt-4">
        <button
          onClick={openOverlay}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          オーバーレイを開く
        </button>
      </div>
      <CaptureSection />
      <LastBattleQuickEdit />
      <BattleForm
        suggestedResult={suggestedResult}
        onSuggestedResultConsumed={() => setSuggestedResult(null)}
        suggestedTurnOrder={suggestedTurnOrder}
        onSuggestedTurnOrderConsumed={() => setSuggestedTurnOrder(null)}
      />
    </div>
  );
}
