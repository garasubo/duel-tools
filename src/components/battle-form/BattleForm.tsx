import { useEffect, useRef, useState, useCallback } from "react";
import { useOwnDecks } from "../../state/hooks/useOwnDecks";
import { useOpponentDecks } from "../../state/hooks/useOpponentDecks";
import { useTags } from "../../state/hooks/useTags";
import { useLatestRecord, useRecords } from "../../state/hooks/useRecords";
import { useBattlesStore } from "../../state/BattlesProvider";
import { useCaptureContext } from "../../capture/useCaptureContext";
import { captureLog } from "../../capture/captureLog";
import type { TurnOrderDetectionEvent } from "../../capture/types";
import type { BattleResult } from "../../types";
import Button from "../ui/Button";
import BattleFields from "./BattleFields";
import {
  applyConfirmedScoreToBattleForm,
  applySuggestedResultToBattleForm,
  applyScoreSuggestionToBattleForm,
  createInitialBattleFormState,
  createNextBattleFormState,
  isBattleFormValid,
  shouldAutoSubmitSuggestedResult,
} from "./types";
import type { BattleFormState } from "./types";

interface BattleFormProps {
  suggestedResult?: BattleResult | null;
  onSuggestedResultConsumed?: () => void;
  capturePreviewResult?: BattleResult | null;
  onCapturePreviewResultConsumed?: () => void;
  suggestedTurnOrder?: TurnOrderDetectionEvent | null;
  onSuggestedTurnOrderConsumed?: () => void;
  suggestedScore?: number | null;
  onSuggestedScoreConsumed?: () => void;
  ratingConfirmToken?: number;
  onRecordSaved?: () => void;
  onTurnOrderCleared?: () => void;
}

export default function BattleForm({
  suggestedResult,
  onSuggestedResultConsumed,
  capturePreviewResult,
  onCapturePreviewResultConsumed,
  suggestedTurnOrder,
  onSuggestedTurnOrderConsumed,
  suggestedScore,
  onSuggestedScoreConsumed,
  ratingConfirmToken = 0,
  onRecordSaved,
  onTurnOrderCleared,
}: BattleFormProps) {
  const { captureRatingOnce, captureDpOnce, isCapturing, setPostResultScanMode } = useCaptureContext();
  const [isCapturingRating, setIsCapturingRating] = useState(false);
  const [captureRatingFailed, setCaptureRatingFailed] = useState(false);
  const store = useBattlesStore();
  const { items: ownDecks, add: addOwnDeck } = useOwnDecks();
  const { items: opponentDecks, add: addOpponentDeck } = useOpponentDecks();
  const { items: knownTags, add: addKnownTag } = useTags();
  const { add: addRecord } = useRecords();
  const latestRecord = useLatestRecord();

  const [form, setForm] = useState<BattleFormState>(
    () => store.getDraftForm() ?? createInitialBattleFormState(latestRecord),
  );
  const [saved, setSaved] = useState(false);
  const [captureResultApplied, setCaptureResultApplied] = useState(false);
  const autoSubmitRef = useRef(false);
  const [autoSubmitTick, setAutoSubmitTick] = useState(0);
  const latestFormRef = useRef(form);

  useEffect(() => {
    latestFormRef.current = form;
  }, [form]);

  const replaceForm = useCallback((nextForm: BattleFormState) => {
    latestFormRef.current = nextForm;
    setForm(nextForm);
  }, []);

  const updateForm = useCallback((updater: (current: BattleFormState) => BattleFormState) => {
    const nextForm = updater(latestFormRef.current);
    replaceForm(nextForm);
    return nextForm;
  }, [replaceForm]);

  // キャプチャ中の DC モードでは結果反映時の ±1000 見積りをスキップし、画面 DP 検出に任せる。
  // 検出系 effect の依存に isCapturing を増やさないよう ref で参照する。
  const isCapturingRef = useRef(isCapturing);
  useEffect(() => {
    isCapturingRef.current = isCapturing;
  }, [isCapturing]);

  // 入力途中のコイントス結果・勝敗を共有ストアへ公開し、簡易戦績パネルと
  // 別ウィンドウのオーバーレイの両方に試合数・コイン勝率・全体/先攻/後攻を反映する。
  useEffect(() => {
    store.setDraftBattle({ turnOrder: form.turnOrder, result: form.result });
  }, [form.turnOrder, form.result, store]);

  // 記録タブを離れて再マウントされても入力途中フォームを失わないよう、
  // フォーム全体を共有ストアのメモリ上スタッシュへ退避する。
  useEffect(() => {
    store.setDraftForm(form);
  }, [form, store]);

  // 記録タブを離れたら入力途中表示を残さない。
  useEffect(
    () => () => store.setDraftBattle({ turnOrder: null, result: null }),
    [store],
  );

  const submitForm = useCallback(
    (currentForm: BattleFormState) => {
      addRecord({
        ownDeckId: currentForm.ownDeckId,
        opponentDeckId: currentForm.opponentDeckId,
        result: currentForm.result!,
        turnOrder: currentForm.turnOrder!,
        reasonTags: currentForm.reasonTags,
        memo: currentForm.memo,
        battleMode: currentForm.battleMode ?? undefined,
        score: currentForm.score !== "" ? Number(currentForm.score) : undefined,
      });
      // 保存済みレコードへ反映するのと同じバッチで入力途中分をクリアし、
      // 簡易戦績の一瞬の二重計上を防ぐ。
      store.setDraftBattle({ turnOrder: null, result: null });
      onRecordSaved?.();
      captureLog("battle-form", `submitForm: recorded ${currentForm.result}, form reset (result→null)`);
      replaceForm(createNextBattleFormState(currentForm));
      setSaved(true);
      setCaptureResultApplied(false);
      setTimeout(() => setSaved(false), 3000);
    },
    [addRecord, onRecordSaved, replaceForm, store],
  );

  const suggestedScoreRef = useRef<number | null>(null);
  useEffect(() => {
    suggestedScoreRef.current = suggestedScore ?? null;
  }, [suggestedScore]);

  useEffect(() => {
    setPostResultScanMode(
      form.battleMode === 'rated' ? 'rating' : form.battleMode === 'duelists-cup' ? 'dp' : null,
    );
  }, [form.battleMode, setPostResultScanMode]);

  useEffect(() => {
    if (!suggestedResult) return;
    autoSubmitRef.current = shouldAutoSubmitSuggestedResult(latestFormRef.current);
    captureLog(
      "battle-form",
      `result effect fire ${suggestedResult} (before=${latestFormRef.current.result}, autoSubmit=${autoSubmitRef.current})`,
    );
    queueMicrotask(() => {
      setCaptureResultApplied(true);
      updateForm((current) => {
        let newForm = applySuggestedResultToBattleForm(current, suggestedResult, store.getState().records, {
          skipAutoScore: isCapturingRef.current,
        });
        if (suggestedScoreRef.current != null) {
          newForm = applyScoreSuggestionToBattleForm(newForm, suggestedScoreRef.current);
        }
        return newForm;
      });
      setAutoSubmitTick((t) => t + 1);
      onSuggestedResultConsumed?.();
    });
  }, [suggestedResult, store, onSuggestedResultConsumed, updateForm]);

  useEffect(() => {
    if (!capturePreviewResult) return;
    captureLog(
      "battle-form",
      `preview effect fire ${capturePreviewResult} (before=${latestFormRef.current.result})`,
    );
    queueMicrotask(() => {
      setCaptureResultApplied(true);
      updateForm((current) =>
        applySuggestedResultToBattleForm(current, capturePreviewResult, store.getState().records, {
          skipAutoScore: isCapturingRef.current,
        }),
      );
      onCapturePreviewResultConsumed?.();
    });
  }, [capturePreviewResult, store, onCapturePreviewResultConsumed, updateForm]);

  const suggestedTurnOrderId = suggestedTurnOrder?.id;
  const suggestedTurnOrderValue = suggestedTurnOrder?.order;
  useEffect(() => {
    if (!suggestedTurnOrderId || !suggestedTurnOrderValue) return;
    queueMicrotask(() => {
      updateForm((current) => ({ ...current, turnOrder: suggestedTurnOrderValue }));
      onSuggestedTurnOrderConsumed?.();
    });
  }, [suggestedTurnOrderId, suggestedTurnOrderValue, onSuggestedTurnOrderConsumed, updateForm]);

  useEffect(() => {
    if (suggestedScore == null) return;
    queueMicrotask(() => {
      updateForm((current) => applyScoreSuggestionToBattleForm(current, suggestedScore));
      onSuggestedScoreConsumed?.();
    });
  }, [suggestedScore, onSuggestedScoreConsumed, updateForm]);

  useEffect(() => {
    if (!autoSubmitRef.current) return;
    autoSubmitRef.current = false;
    queueMicrotask(() => {
      const currentForm = latestFormRef.current;
      if (
        isBattleFormValid(currentForm) &&
        shouldAutoSubmitSuggestedResult(currentForm)
      ) {
        submitForm(currentForm);
      }
    });
  }, [form, autoSubmitTick, submitForm]);

  const ratingConfirmTokenRef = useRef(ratingConfirmToken);
  useEffect(() => {
    if (ratingConfirmTokenRef.current === ratingConfirmToken) return;
    ratingConfirmTokenRef.current = ratingConfirmToken;
    queueMicrotask(() => {
      const nextForm = updateForm((current) =>
        applyConfirmedScoreToBattleForm(current, suggestedScoreRef.current),
      );
      if (isBattleFormValid(nextForm)) {
        submitForm(nextForm);
      }
    });
  }, [ratingConfirmToken, submitForm, updateForm]);

  const isValid = isBattleFormValid(form);

  function patchForm(patch: Partial<BattleFormState>) {
    updateForm((current) => ({ ...current, ...patch }));
  }

  function handleFieldsChange(patch: Partial<BattleFormState>) {
    if (patch.turnOrder === null && latestFormRef.current.turnOrder !== null) {
      onTurnOrderCleared?.();
    }
    patchForm(patch);
  }

  function handleAddOwnDeck(name: string) {
    const deck = addOwnDeck(name);
    patchForm({ ownDeckId: deck.id });
  }

  function handleAddOpponentDeck(name: string) {
    const deck = addOpponentDeck(name);
    patchForm({ opponentDeckId: deck.id });
  }

  function handleResultChange(result: BattleResult | null) {
    setCaptureResultApplied(false);
    if (result === null) {
      patchForm({ result: null });
    } else {
      updateForm((current) =>
        applySuggestedResultToBattleForm(current, result, store.getState().records, {
          skipAutoScore: isCapturing,
        }),
      );
    }
  }

  // 対戦モードに応じてレート / DP を画面から手動読み取りする。
  const handleCaptureScoreOnce = useCallback(async () => {
    setIsCapturingRating(true);
    setCaptureRatingFailed(false);
    try {
      const score =
        latestFormRef.current.battleMode === 'duelists-cup'
          ? await captureDpOnce()
          : await captureRatingOnce();
      if (score !== null) {
        updateForm((current) => ({ ...current, score: String(score) }));
      } else {
        setCaptureRatingFailed(true);
        setTimeout(() => setCaptureRatingFailed(false), 3000);
      }
    } finally {
      setIsCapturingRating(false);
    }
  }, [captureRatingOnce, captureDpOnce, updateForm]);

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const currentForm = latestFormRef.current;
    if (!isBattleFormValid(currentForm)) return;
    submitForm(currentForm);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4 pb-4 max-w-4xl">
      <BattleFields
        value={form}
        onChange={handleFieldsChange}
        ownDecks={ownDecks}
        opponentDecks={opponentDecks}
        knownTags={knownTags}
        onAddOwnDeck={handleAddOwnDeck}
        onAddOpponentDeck={handleAddOpponentDeck}
        onAddKnownTag={addKnownTag}
        onResultChange={handleResultChange}
        onCaptureRating={isCapturing ? handleCaptureScoreOnce : undefined}
        isCapturingRating={isCapturingRating}
        captureRatingFailed={captureRatingFailed}
      />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!isValid}>
          記録する
        </Button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">
            記録しました！
          </span>
        )}
        {captureResultApplied && !isValid && !saved && (
          <span className="text-sm text-blue-600 font-medium">
            勝敗だけ反映しました。未入力を埋めると記録できます。
          </span>
        )}
      </div>
    </form>
  );
}
