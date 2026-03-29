import { useState } from "react";
import { useBattlesContext } from "../../context/BattlesContext";
import type { BattleResult, TurnOrder } from "../../types";
import Button from "../ui/Button";
import DeckSelect from "./DeckSelect";
import ResultSelector from "./ResultSelector";
import TurnOrderSelector from "./TurnOrderSelector";
import TagInput from "./TagInput";
import MemoInput from "./MemoInput";

interface FormState {
  ownDeckId: string;
  opponentDeckId: string;
  result: BattleResult | null;
  turnOrder: TurnOrder | null;
  reasonTags: string[];
  memo: string;
}

const INITIAL_STATE: FormState = {
  ownDeckId: "",
  opponentDeckId: "",
  result: null,
  turnOrder: null,
  reasonTags: [],
  memo: "",
};

export default function BattleForm() {
  const {
    ownDecks,
    opponentDecks,
    knownTags,
    addRecord,
    addOwnDeck,
    addOpponentDeck,
    addKnownTag,
  } = useBattlesContext();

  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [saved, setSaved] = useState(false);

  const isValid =
    form.ownDeckId !== "" &&
    form.opponentDeckId !== "" &&
    form.result !== null &&
    form.turnOrder !== null;

  function handleAddOwnDeck(name: string) {
    const deck = addOwnDeck(name);
    setForm((f) => ({ ...f, ownDeckId: deck.id }));
  }

  function handleAddOpponentDeck(name: string) {
    const deck = addOpponentDeck(name);
    setForm((f) => ({ ...f, opponentDeckId: deck.id }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    addRecord({
      ownDeckId: form.ownDeckId,
      opponentDeckId: form.opponentDeckId,
      result: form.result!,
      turnOrder: form.turnOrder!,
      reasonTags: form.reasonTags,
      memo: form.memo,
    });
    setForm({ ...INITIAL_STATE, ownDeckId: form.ownDeckId });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4 max-w-lg">
      <DeckSelect
        label="自分のデッキ"
        decks={ownDecks}
        value={form.ownDeckId}
        onChange={(id) => setForm((f) => ({ ...f, ownDeckId: id }))}
        onAddDeck={handleAddOwnDeck}
      />

      <DeckSelect
        label="相手のデッキ"
        decks={opponentDecks}
        value={form.opponentDeckId}
        onChange={(id) => setForm((f) => ({ ...f, opponentDeckId: id }))}
        onAddDeck={handleAddOpponentDeck}
      />

      <TurnOrderSelector
        value={form.turnOrder}
        onChange={(turnOrder) => setForm((f) => ({ ...f, turnOrder }))}
      />

      <ResultSelector
        value={form.result}
        onChange={(result) => setForm((f) => ({ ...f, result }))}
      />

      <TagInput
        tags={form.reasonTags}
        knownTags={knownTags}
        onChange={(reasonTags) => setForm((f) => ({ ...f, reasonTags }))}
        onAddKnownTag={addKnownTag}
      />

      <MemoInput
        value={form.memo}
        onChange={(memo) => setForm((f) => ({ ...f, memo }))}
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
