import { useState, useRef } from 'react';
import type { DeckCounts, CardLabels } from '../../utils/starterRate';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';

export interface DeckEditorProps {
  deckCounts: DeckCounts;
  deckSize: number;
  cardLabels: CardLabels;
  onDeckSizeChange: (size: number) => void;
  onAdd: (name: string, count: number) => void;
  onRemove: (name: string) => void;
  onCountChange: (name: string, count: number) => void;
  onLabelChange: (cardName: string, labels: string[]) => void;
}

export default function DeckEditor({
  deckCounts,
  deckSize,
  cardLabels,
  onDeckSizeChange,
  onAdd,
  onRemove,
  onCountChange,
  onLabelChange,
}: DeckEditorProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCount, setNewCount] = useState(1);
  const [addError, setAddError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [editingLabelFor, setEditingLabelFor] = useState<string | null>(null);
  const [newLabelText, setNewLabelText] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const deckTotal = Object.values(deckCounts).reduce((s, n) => s + n, 0);

  const totalColorClass =
    deckTotal === deckSize
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : deckTotal > deckSize
        ? 'bg-red-100 text-red-800 border-red-200'
        : 'bg-amber-100 text-amber-800 border-amber-200';

  function handleStartAdd() {
    setNewName('');
    setNewCount(1);
    setAddError(null);
    setAdding(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }

  function handleConfirmAdd() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setAddError('カード名を入力してください');
      return;
    }
    if (trimmed in deckCounts) {
      setAddError('このカード名はすでに追加されています');
      return;
    }
    if (newCount < 1) {
      setAddError('枚数は1以上にしてください');
      return;
    }
    onAdd(trimmed, newCount);
    setAdding(false);
    setNewName('');
    setNewCount(1);
    setAddError(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleConfirmAdd();
    if (e.key === 'Escape') {
      setAdding(false);
      setAddError(null);
    }
  }

  function handleRemoveClick(name: string) {
    setConfirmRemove(name);
  }

  function handleConfirmRemove() {
    if (confirmRemove) {
      onRemove(confirmRemove);
      setConfirmRemove(null);
    }
  }

  function handleStartLabelEdit(cardName: string) {
    setEditingLabelFor(cardName);
    setNewLabelText('');
    setTimeout(() => labelInputRef.current?.focus(), 0);
  }

  function handleConfirmAddLabel(cardName: string) {
    const trimmed = newLabelText.trim();
    if (!trimmed) {
      setEditingLabelFor(null);
      return;
    }
    const existing = cardLabels[cardName] ?? [];
    if (!existing.includes(trimmed)) {
      onLabelChange(cardName, [...existing, trimmed]);
    }
    setNewLabelText('');
    setEditingLabelFor(null);
  }

  function handleLabelKeyDown(e: React.KeyboardEvent, cardName: string) {
    if (e.key === 'Enter') handleConfirmAddLabel(cardName);
    if (e.key === 'Escape') {
      setNewLabelText('');
      setEditingLabelFor(null);
    }
  }

  function handleRemoveLabel(cardName: string, label: string) {
    const existing = cardLabels[cardName] ?? [];
    onLabelChange(cardName, existing.filter((l) => l !== label));
  }

  const entries = Object.entries(deckCounts);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">デッキ構築</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">デッキ枚数:</label>
          <input
            type="number"
            min={1}
            value={deckSize}
            onChange={(e) => onDeckSizeChange(Math.max(1, Number(e.target.value)))}
            className="w-16 rounded-lg border border-gray-300 px-2 py-0.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${totalColorClass}`}
          >
            {deckTotal} / {deckSize}枚
          </span>
        </div>
      </div>

      <div className="p-3">
        {entries.length === 0 && !adding && (
          <EmptyState
            title="カードがありません"
            description="デッキにカードを追加してください"
            className="py-8"
          />
        )}

        {entries.map(([name, count]) => (
          <div key={name} className="group">
            {confirmRemove === name ? (
              <div className="flex items-center gap-2 py-1.5 px-1 bg-red-50 rounded-lg mb-1">
                <span className="flex-1 text-xs text-red-700">
                  「{name}」を削除しますか？（条件からも削除されます）
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleConfirmRemove}
                >
                  削除
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmRemove(null)}
                >
                  ✕
                </Button>
              </div>
            ) : (
              <div className="rounded-lg hover:bg-gray-50 px-1 py-1 mb-1">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-gray-800 truncate">
                    {name}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={count}
                    onChange={(e) =>
                      onCountChange(name, Math.max(1, Number(e.target.value)))
                    }
                    className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-gray-400">枚</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveClick(name)}
                    aria-label={`${name}を削除`}
                  >
                    ✕
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-1 mt-1 min-h-[1.5rem]">
                  {(cardLabels[name] ?? []).map((lbl) => (
                    <span
                      key={lbl}
                      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200"
                    >
                      {lbl}
                      <button
                        type="button"
                        onClick={() => handleRemoveLabel(name, lbl)}
                        className="ml-0.5 text-teal-400 hover:text-teal-700 leading-none"
                        aria-label={`ラベル「${lbl}」を削除`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {editingLabelFor === name ? (
                    <input
                      ref={labelInputRef}
                      type="text"
                      value={newLabelText}
                      onChange={(e) => setNewLabelText(e.target.value)}
                      onKeyDown={(e) => handleLabelKeyDown(e, name)}
                      onBlur={() => handleConfirmAddLabel(name)}
                      placeholder="ラベル名"
                      className="w-24 rounded-md border border-teal-300 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartLabelEdit(name)}
                      className="text-xs text-gray-300 hover:text-teal-500 group-hover:text-gray-400 transition-colors"
                    >
                      + ラベル
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {adding && (
          <div className="mt-2 border border-indigo-200 rounded-lg p-3 bg-indigo-50">
            <div className="flex items-center gap-2">
              <input
                ref={nameInputRef}
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setAddError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="カード名"
                className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              <input
                type="number"
                min={1}
                max={99}
                value={newCount}
                onChange={(e) => setNewCount(Math.max(1, Number(e.target.value)))}
                onKeyDown={handleKeyDown}
                className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              <span className="text-xs text-gray-500">枚</span>
              <Button variant="primary" size="sm" onClick={handleConfirmAdd}>
                追加
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdding(false);
                  setAddError(null);
                }}
              >
                ✕
              </Button>
            </div>
            {addError && (
              <p className="mt-1 text-xs text-red-600">{addError}</p>
            )}
          </div>
        )}

        {!adding && (
          <button
            type="button"
            onClick={handleStartAdd}
            className="mt-2 w-full border border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors duration-150 cursor-pointer"
          >
            + カードを追加
          </button>
        )}
      </div>
    </div>
  );
}
