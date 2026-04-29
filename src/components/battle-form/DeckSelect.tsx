import { useState } from "react";
import type { Deck } from "../../types";

export interface DeckSelectProps {
  label: string;
  decks: Deck[];
  value: string;
  onChange: (id: string) => void;
  onAddDeck: (name: string) => void;
  allowUnknown?: boolean;
}

const ADD_NEW = "__add_new__";

export default function DeckSelect({
  label,
  decks,
  value,
  onChange,
  onAddDeck,
  allowUnknown,
}: DeckSelectProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === ADD_NEW) {
      setAdding(true);
    } else {
      onChange(e.target.value);
    }
  }

  function handleAddSubmit() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAddDeck(trimmed);
    setNewName("");
    setAdding(false);
  }

  function handleAddKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSubmit();
    } else if (e.key === "Escape") {
      setAdding(false);
      setNewName("");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {adding ? (
        <div className="flex gap-2">
          <input
            type="text"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleAddKeyDown}
            placeholder="デッキ名を入力"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={handleAddSubmit}
            disabled={!newName.trim()}
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            追加
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setNewName("");
            }}
            className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"
          >
            キャンセル
          </button>
        </div>
      ) : (
        <select
          value={value}
          onChange={handleSelectChange}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="">{allowUnknown ? "不明" : "選択してください"}</option>
          {decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
          <option value={ADD_NEW}>+ 新しいデッキを追加</option>
        </select>
      )}
    </div>
  );
}
