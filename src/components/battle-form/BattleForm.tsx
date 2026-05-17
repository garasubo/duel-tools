import { useEffect, useRef, useState, useCallback } from "react";
import { useOwnDecks } from "../../state/hooks/useOwnDecks";
import { useOpponentDecks } from "../../state/hooks/useOpponentDecks";
import { useTags } from "../../state/hooks/useTags";
import { useLatestRecord, useRecords } from "../../state/hooks/useRecords";
import { useBattlesStore } from "../../state/BattlesProvider";
import type { TurnOrderDetectionEvent } from "../../capture/types";
import type { BattleResult } from "../../types";
import Button from "../ui/Button";
import BattleFields from "./BattleFields";
import {
  applySuggestedResultToBattleForm,
  createInitialBattleFormState,
  createNextBattleFormState,
  isBattleFormValid,
} from "./types";
import type { BattleFormState } from "./types";

interface BattleFormProps {
  suggestedResult?: BattleResult | null;
  onSuggestedResultConsumed?: () => void;
  capturePreviewResult?: BattleResult | null;
  onCapturePreviewResultConsumed?: () => void;
  suggestedTurnOrder?: TurnOrderDetectionEvent | null;
  onSuggestedTurnOrderConsumed?: () => void;
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
  onRecordSaved,
  onTurnOrderCleared,
}: BattleFormProps) {
  const store = useBattlesStore();
  const { items: ownDecks, add: addOwnDeck } = useOwnDecks();
  const { items: opponentDecks, add: addOpponentDeck } = useOpponentDecks();
  const { items: knownTags, add: addKnownTag } = useTags();
  const { add: addRecord } = useRecords();
  const latestRecord = useLatestRecord();

  const [form, setForm] = useState<BattleFormState>(() =>
    createInitialBattleFormState(latestRecord),
  );
  const [saved, setSaved] = useState(false);
  const [captureResultApplied, setCaptureResultApplied] = useState(false);
  const autoSubmitRef = useRef(false);
  const [autoSubmitTick, setAutoSubmitTick] = useState(0);

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
      onRecordSaved?.();
      setForm(createNextBattleFormState(currentForm));
      setSaved(true);
      setCaptureResultApplied(false);
      setTimeout(() => setSaved(false), 3000);
    },
    [addRecord, onRecordSaved],
  );

  useEffect(() => {
    if (!suggestedResult) return;
    autoSubmitRef.current = true;
    queueMicrotask(() => {
      setCaptureResultApplied(true);
      setForm((f) =>
        applySuggestedResultToBattleForm(f, suggestedResult, store.getState().records),
      );
      setAutoSubmitTick((t) => t + 1);
      onSuggestedResultConsumed?.();
    });
  }, [suggestedResult, store, onSuggestedResultConsumed]);

  useEffect(() => {
    if (!capturePreviewResult) return;
    queueMicrotask(() => {
      setCaptureResultApplied(true);
      setForm((f) =>
        applySuggestedResultToBattleForm(
          f,
          capturePreviewResult,
          store.getState().records,
        ),
      );
      onCapturePreviewResultConsumed?.();
    });
  }, [capturePreviewResult, store, onCapturePreviewResultConsumed]);

  const suggestedTurnOrderId = suggestedTurnOrder?.id;
  const suggestedTurnOrderValue = suggestedTurnOrder?.order;
  useEffect(() => {
    if (!suggestedTurnOrderId || !suggestedTurnOrderValue) return;
    queueMicrotask(() => {
      setForm((f) => ({ ...f, turnOrder: suggestedTurnOrderValue }));
      onSuggestedTurnOrderConsumed?.();
    });
  }, [suggestedTurnOrderId, suggestedTurnOrderValue, onSuggestedTurnOrderConsumed]);

  useEffect(() => {
    if (!autoSubmitRef.current) return;
    autoSubmitRef.current = false;
    if (isBattleFormValid(form)) {
      queueMicrotask(() => submitForm(form));
    }
  }, [form, autoSubmitTick, submitForm]);

  const isValid = isBattleFormValid(form);

  function patchForm(patch: Partial<BattleFormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function handleFieldsChange(patch: Partial<BattleFormState>) {
    if (patch.turnOrder === null && form.turnOrder !== null) {
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

  function handleResultChange(result: BattleResult) {
    setCaptureResultApplied(false);
    setForm((f) =>
      applySuggestedResultToBattleForm(f, result, store.getState().records),
    );
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid) return;
    submitForm(form);
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
