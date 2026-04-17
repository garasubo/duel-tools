import { useState } from "react";
import type { BattleRecord } from "../../types";
import Button from "../ui/Button";
import BattleFields from "../battle-form/BattleFields";
import {
  isBattleFormValid,
  type BattleFormState,
} from "../battle-form/types";
import type { Deck } from "../../types";

export interface RecordDetailEditProps {
  record: BattleRecord;
  ownDecks: Deck[];
  opponentDecks: Deck[];
  knownTags: string[];
  onAddOwnDeck: (name: string) => Deck;
  onAddOpponentDeck: (name: string) => Deck;
  onAddKnownTag: (tag: string) => void;
  onSave: (
    patch: Partial<Omit<BattleRecord, "id" | "createdAt">>,
  ) => void;
  onCancel: () => void;
}

function toFormState(record: BattleRecord): BattleFormState {
  return {
    ownDeckId: record.ownDeckId,
    opponentDeckId: record.opponentDeckId,
    result: record.result,
    turnOrder: record.turnOrder,
    reasonTags: record.reasonTags,
    memo: record.memo,
    battleMode: record.battleMode ?? null,
    score: record.score !== undefined ? String(record.score) : "",
  };
}

export default function RecordDetailEdit({
  record,
  ownDecks,
  opponentDecks,
  knownTags,
  onAddOwnDeck,
  onAddOpponentDeck,
  onAddKnownTag,
  onSave,
  onCancel,
}: RecordDetailEditProps) {
  const [form, setForm] = useState<BattleFormState>(toFormState(record));

  const isValid = isBattleFormValid(form);

  function patchForm(patch: Partial<BattleFormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function handleAddOwnDeck(name: string) {
    const deck = onAddOwnDeck(name);
    patchForm({ ownDeckId: deck.id });
  }

  function handleAddOpponentDeck(name: string) {
    const deck = onAddOpponentDeck(name);
    patchForm({ opponentDeckId: deck.id });
  }

  function handleSave() {
    if (!isValid) return;
    onSave({
      ownDeckId: form.ownDeckId,
      opponentDeckId: form.opponentDeckId,
      result: form.result!,
      turnOrder: form.turnOrder!,
      reasonTags: form.reasonTags,
      memo: form.memo,
      battleMode: form.battleMode ?? undefined,
      score: form.score !== "" ? Number(form.score) : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <BattleFields
        value={form}
        onChange={patchForm}
        ownDecks={ownDecks}
        opponentDecks={opponentDecks}
        knownTags={knownTags}
        onAddOwnDeck={handleAddOwnDeck}
        onAddOpponentDeck={handleAddOpponentDeck}
        onAddKnownTag={onAddKnownTag}
      />
      <div className="flex gap-2 pt-1">
        <Button onClick={handleSave} disabled={!isValid}>
          保存
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          キャンセル
        </Button>
      </div>
    </div>
  );
}
