import { useState } from "react";
import { useBattlesContext } from "../../context/BattlesContext";
import { getScoreBounds, getScoreLabel } from "../../utils/battleMode";
import type { BattleMode, BattleResult, TurnOrder } from "../../types";
import DeckSelect from "./DeckSelect";

const TURN_ORDER_OPTIONS: { value: TurnOrder; label: string }[] = [
  { value: "first", label: "先攻" },
  { value: "second", label: "後攻" },
  { value: "third", label: "ゆずられ先攻" },
];

const RESULT_OPTIONS: { value: BattleResult; label: string }[] = [
  { value: "win", label: "勝ち" },
  { value: "loss", label: "負け" },
];

interface ScoreInputProps {
  initialValue: string;
  mode: BattleMode;
  onChange: (value: string) => void;
}

function ScoreInput({ initialValue, mode, onChange }: ScoreInputProps) {
  const [value, setValue] = useState(initialValue);
  const bounds = getScoreBounds(mode);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
    onChange(e.target.value);
  }

  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs text-gray-500">{getScoreLabel(mode)}</label>
      <input
        type="number"
        value={value}
        onChange={handleChange}
        min={bounds.min}
        max={bounds.max}
        className="w-28 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}

const selectClass =
  "rounded border border-gray-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function LastBattleQuickEdit() {
  const [open, setOpen] = useState(false);
  const { records, opponentDecks, addOpponentDeck, updateRecord } =
    useBattlesContext();

  const latestRecord =
    records.length > 0
      ? records.reduce((a, b) => (a.createdAt > b.createdAt ? a : b))
      : null;

  if (!latestRecord) return null;

  function handleAddOpponentDeck(name: string) {
    const deck = addOpponentDeck(name);
    updateRecord(latestRecord!.id, { opponentDeckId: deck.id });
  }

  return (
    <div className="mx-4 my-3 rounded-xl border border-gray-200 bg-white max-w-lg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
      >
        <span>前の試合を修正</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-wrap items-end gap-3">
          <DeckSelect
            label="相手のデッキ"
            decks={opponentDecks}
            value={latestRecord.opponentDeckId}
            onChange={(id) =>
              updateRecord(latestRecord.id, { opponentDeckId: id })
            }
            onAddDeck={handleAddOpponentDeck}
            allowUnknown
          />
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-gray-500">手番</label>
            <select
              value={latestRecord.turnOrder}
              onChange={(e) =>
                updateRecord(latestRecord.id, {
                  turnOrder: e.target.value as TurnOrder,
                })
              }
              className={selectClass}
            >
              {TURN_ORDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-gray-500">勝敗</label>
            <select
              value={latestRecord.result}
              onChange={(e) =>
                updateRecord(latestRecord.id, {
                  result: e.target.value as BattleResult,
                })
              }
              className={selectClass}
            >
              {RESULT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {latestRecord.battleMode && (
            <ScoreInput
              key={latestRecord.id}
              initialValue={
                latestRecord.score !== undefined
                  ? String(latestRecord.score)
                  : ""
              }
              mode={latestRecord.battleMode}
              onChange={(value) =>
                updateRecord(latestRecord.id, {
                  score: value !== "" ? Number(value) : undefined,
                })
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
