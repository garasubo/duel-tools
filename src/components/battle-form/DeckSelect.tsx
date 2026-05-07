import { useState } from "react";
import type { Deck } from "../../types";
import { findDeckByName, normalizeDeckName } from "../../utils/decks";

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
  const [error, setError] = useState("");

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === ADD_NEW) {
      setAdding(true);
      setError("");
    } else {
      onChange(e.target.value);
    }
  }

  function handleAddSubmit() {
    const trimmed = normalizeDeckName(newName);
    if (!trimmed) return;
    if (findDeckByName(decks, trimmed)) {
      setError("同じデッキ名は追加できません");
      return;
    }
    onAddDeck(trimmed);
    setNewName("");
    setError("");
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
          <div className="flex-1">
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setError("");
              }}
              onKeyDown={handleAddKeyDown}
              placeholder="デッキ名を入力"
              aria-invalid={error ? true : undefined}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </div>
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
              setError("");
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
