import { useEffect, useRef, useState } from "react";
import { useBattlesContext } from "../../context/BattlesContext";
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
  suggestedTurnOrder?: TurnOrderDetectionEvent | null;
  onSuggestedTurnOrderConsumed?: () => void;
  onRecordSaved?: () => void;
  onTurnOrderCleared?: () => void;
}

export default function BattleForm({
  suggestedResult,
  onSuggestedResultConsumed,
  suggestedTurnOrder,
  onSuggestedTurnOrderConsumed,
  onRecordSaved,
  onTurnOrderCleared,
}: BattleFormProps) {
  const {
    records,
    ownDecks,
    opponentDecks,
    knownTags,
    addRecord,
    addOwnDeck,
    addOpponentDeck,
    addKnownTag,
  } = useBattlesContext();

  const latestRecord =
    records.length > 0
      ? records.reduce((a, b) => (a.createdAt > b.createdAt ? a : b))
      : null;

  const [form, setForm] = useState<BattleFormState>(
    createInitialBattleFormState(latestRecord),
  );
  const [saved, setSaved] = useState(false);
  const [captureResultApplied, setCaptureResultApplied] = useState(false);
  const autoSubmitRef = useRef(false);

  function submitForm(currentForm: BattleFormState) {
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
  }

  useEffect(() => {
    if (suggestedResult) {
      autoSubmitRef.current = true;
      queueMicrotask(() => {
        setCaptureResultApplied(true);
        setForm((f) => {
          return applySuggestedResultToBattleForm(f, suggestedResult, records);
        });
        onSuggestedResultConsumed?.();
      });
    }
  }, [suggestedResult]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (suggestedTurnOrder) {
      queueMicrotask(() => {
        setForm((f) => ({ ...f, turnOrder: suggestedTurnOrder.order }));
        onSuggestedTurnOrderConsumed?.();
      });
    }
  }, [suggestedTurnOrder?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoSubmitRef.current) return;
    autoSubmitRef.current = false;
    if (isBattleFormValid(form)) {
      queueMicrotask(() => submitForm(form));
    }
  }, [form]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setForm((f) => {
      return applySuggestedResultToBattleForm(f, result, records);
    });
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid) return;
    submitForm(form);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4 max-w-4xl">
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
