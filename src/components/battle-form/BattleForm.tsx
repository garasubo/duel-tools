import { useState } from "react";
import { useBattlesContext } from "../../context/BattlesContext";
import type { BattleMode, BattleResult, TurnOrder } from "../../types";
import Button from "../ui/Button";
import ToggleButton, { ToggleButtonGroup } from "../ui/ToggleButton";
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
  battleMode: BattleMode | null;
  score: string;
}

const INITIAL_STATE: FormState = {
  ownDeckId: "",
  opponentDeckId: "",
  result: null,
  turnOrder: null,
  reasonTags: [],
  memo: "",
  battleMode: null,
  score: "",
};

const BATTLE_MODE_OPTIONS: { value: BattleMode; label: string }[] = [
  { value: "duelists-cup", label: "デュエリストカップ" },
  { value: "rated", label: "レート戦" },
];

export default function BattleForm() {
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

  const [form, setForm] = useState<FormState>(
    latestRecord
      ? {
          ...INITIAL_STATE,
          ownDeckId: latestRecord.ownDeckId,
          battleMode: latestRecord.battleMode ?? null,
        }
      : INITIAL_STATE,
  );
  const [saved, setSaved] = useState(false);

  const isValid =
    form.ownDeckId !== "" && form.result !== null && form.turnOrder !== null;

  function handleAddOwnDeck(name: string) {
    const deck = addOwnDeck(name);
    setForm((f) => ({ ...f, ownDeckId: deck.id }));
  }

  function handleAddOpponentDeck(name: string) {
    const deck = addOpponentDeck(name);
    setForm((f) => ({ ...f, opponentDeckId: deck.id }));
  }

  function handleResultChange(result: BattleResult) {
    setForm((f) => {
      if (f.battleMode === "duelists-cup" && f.score === "") {
        const lastRecord = records.find(
          (r) => r.battleMode === "duelists-cup" && r.score !== undefined,
        );
        if (lastRecord !== undefined && lastRecord.score !== undefined) {
          const autoScore =
            result === "win"
              ? lastRecord.score + 1000
              : lastRecord.score - 1000;
          return { ...f, result, score: String(autoScore) };
        }
      }
      return { ...f, result };
    });
  }

  function handleBattleModeChange(mode: BattleMode) {
    setForm((f) => ({
      ...f,
      battleMode: f.battleMode === mode ? null : mode,
      score: "",
    }));
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid) return;
    addRecord({
      ownDeckId: form.ownDeckId,
      opponentDeckId: form.opponentDeckId,
      result: form.result!,
      turnOrder: form.turnOrder!,
      reasonTags: form.reasonTags,
      memo: form.memo,
      battleMode: form.battleMode ?? undefined,
      score: form.score !== "" ? Number(form.score) : undefined,
    });
    setForm({ ...INITIAL_STATE, ownDeckId: form.ownDeckId, battleMode: form.battleMode });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const scoreLabel = form.battleMode === "duelists-cup" ? "DP" : "レート";

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
        allowUnknown
      />

      <TurnOrderSelector
        value={form.turnOrder}
        onChange={(turnOrder) => setForm((f) => ({ ...f, turnOrder }))}
      />

      <ResultSelector value={form.result} onChange={handleResultChange} />

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">対戦モード</span>
        <ToggleButtonGroup label="対戦モード選択">
          {BATTLE_MODE_OPTIONS.map((opt) => (
            <ToggleButton
              key={opt.value}
              isSelected={form.battleMode === opt.value}
              onClick={() => handleBattleModeChange(opt.value)}
            >
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>

      {form.battleMode !== null && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            {scoreLabel}
          </label>
          <input
            type="number"
            value={form.score}
            onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))}
            placeholder={
              form.battleMode === "duelists-cup" ? "例: 50000" : "例: 1500"
            }
            min={form.battleMode === "duelists-cup" ? 0 : 1000}
            max={form.battleMode === "duelists-cup" ? 100000 : 2000}
            className="w-40 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}

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
