import { useEffect, useRef, useState } from "react";
import { useBattlesContext } from "../../context/BattlesContext";
import type { BattleResult } from "../../types";
import Button from "../ui/Button";
import BattleFields from "./BattleFields";
import { EMPTY_BATTLE_FORM_STATE, isBattleFormValid } from "./types";
import type { BattleFormState } from "./types";
import { autoCalcDuelistsCupScore } from "./autoCalcScore";

interface BattleFormProps {
  suggestedResult?: BattleResult | null;
  onSuggestedResultConsumed?: () => void;
}

export default function BattleForm({ suggestedResult, onSuggestedResultConsumed }: BattleFormProps) {
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
    latestRecord
      ? {
          ...EMPTY_BATTLE_FORM_STATE,
          ownDeckId: latestRecord.ownDeckId,
          turnOrder: latestRecord.turnOrder,
          battleMode: latestRecord.battleMode ?? null,
        }
      : EMPTY_BATTLE_FORM_STATE,
  );
  const [saved, setSaved] = useState(false);
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
    setForm({
      ...EMPTY_BATTLE_FORM_STATE,
      ownDeckId: currentForm.ownDeckId,
      turnOrder: currentForm.turnOrder,
      battleMode: currentForm.battleMode,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  useEffect(() => {
    if (suggestedResult) {
      autoSubmitRef.current = true;
      setForm((f) => {
        if (f.battleMode === "duelists-cup" && f.score === "") {
          const autoScore = autoCalcDuelistsCupScore(suggestedResult, records);
          if (autoScore !== null) {
            return { ...f, result: suggestedResult, score: autoScore };
          }
        }
        return { ...f, result: suggestedResult };
      });
      onSuggestedResultConsumed?.();
    }
  }, [suggestedResult]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoSubmitRef.current) return;
    autoSubmitRef.current = false;
    if (isBattleFormValid(form)) {
      submitForm(form);
    }
  }, [form]); // eslint-disable-line react-hooks/exhaustive-deps

  const isValid = isBattleFormValid(form);

  function patchForm(patch: Partial<BattleFormState>) {
    setForm((f) => ({ ...f, ...patch }));
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
    setForm((f) => {
      if (f.battleMode === "duelists-cup" && f.score === "") {
        const autoScore = autoCalcDuelistsCupScore(result, records);
        if (autoScore !== null) {
          return { ...f, result, score: autoScore };
        }
      }
      return { ...f, result };
    });
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid) return;
    submitForm(form);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4 max-w-lg">
      <BattleFields
        value={form}
        onChange={patchForm}
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
      </div>
    </form>
  );
}
