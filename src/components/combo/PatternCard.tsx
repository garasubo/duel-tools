import { useState } from 'react';
import type { Pattern, DeckCounts } from '../../utils/starterRate';
import Button from '../ui/Button';

export interface PatternCardProps {
  pattern: Pattern;
  deckCounts: DeckCounts;
  index: number;
  onRemove: () => void;
  onUpdate: (pattern: Pattern) => void;
}

export default function PatternCard({
  pattern,
  deckCounts,
  index,
  onRemove,
  onUpdate,
}: PatternCardProps) {
  const [addingCard, setAddingCard] = useState(false);
  const [selectedCard, setSelectedCard] = useState('');
  const [requiredCount, setRequiredCount] = useState(1);

  const availableCards = Object.keys(deckCounts).filter(
    (name) => !(name in pattern),
  );

  function handleAddCondition() {
    if (!selectedCard) return;
    const maxCount = deckCounts[selectedCard] ?? 1;
    const clamped = Math.min(requiredCount, maxCount);
    onUpdate({ ...pattern, [selectedCard]: clamped });
    setSelectedCard('');
    setRequiredCount(1);
    setAddingCard(false);
  }

  function handleRemoveCondition(cardName: string) {
    const next = { ...pattern };
    delete next[cardName];
    onUpdate(next);
  }

  function handleRequiredCountChange(cardName: string, value: number) {
    const maxCount = deckCounts[cardName] ?? 1;
    const clamped = Math.max(1, Math.min(value, maxCount));
    onUpdate({ ...pattern, [cardName]: clamped });
  }

  function handleStartAdd() {
    const first = availableCards[0] ?? '';
    setSelectedCard(first);
    setRequiredCount(1);
    setAddingCard(true);
  }

  const conditionEntries = Object.entries(pattern);

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          条件 {index + 1}
        </span>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          ✕
        </Button>
      </div>

      {conditionEntries.length === 0 && !addingCard && (
        <p className="text-xs text-gray-400 mb-2 text-center py-2">
          カードを追加してください
        </p>
      )}

      {conditionEntries.map(([cardName, required], i) => {
        const maxCount = deckCounts[cardName] ?? 1;
        const isOverMax = required > maxCount;
        return (
          <div key={cardName}>
            {i > 0 && (
              <div className="text-xs text-gray-400 text-center my-1">
                かつ
              </div>
            )}
            <div className="flex items-center gap-2 py-1">
              <span
                className={`flex-1 text-sm px-2 py-0.5 rounded-full border text-xs font-medium ${
                  isOverMax
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                }`}
              >
                {cardName}
                {isOverMax && (
                  <span className="ml-1 text-red-500" title="デッキ枚数を超えています">
                    ⚠
                  </span>
                )}
              </span>
              <input
                type="number"
                min={1}
                max={maxCount}
                value={required}
                onChange={(e) =>
                  handleRequiredCountChange(cardName, Number(e.target.value))
                }
                className="w-14 rounded-lg border border-gray-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-xs text-gray-400">枚以上</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveCondition(cardName)}
                aria-label={`${cardName}の条件を削除`}
              >
                ✕
              </Button>
            </div>
          </div>
        );
      })}

      {addingCard && (
        <div>
          {conditionEntries.length > 0 && (
            <div className="text-xs text-gray-400 text-center my-1">かつ</div>
          )}
          <div className="flex items-center gap-2 py-1">
            <select
              value={selectedCard}
              onChange={(e) => setSelectedCard(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {availableCards.length === 0 ? (
                <option value="">カードがありません</option>
              ) : (
                availableCards.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))
              )}
            </select>
            <input
              type="number"
              min={1}
              max={selectedCard ? (deckCounts[selectedCard] ?? 1) : 1}
              value={requiredCount}
              onChange={(e) => setRequiredCount(Number(e.target.value))}
              className="w-14 rounded-lg border border-gray-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-xs text-gray-400">枚以上</span>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddCondition}
              disabled={!selectedCard || availableCards.length === 0}
            >
              追加
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddingCard(false)}
            >
              ✕
            </Button>
          </div>
        </div>
      )}

      {!addingCard && availableCards.length > 0 && (
        <button
          type="button"
          onClick={handleStartAdd}
          className="mt-2 w-full border border-dashed border-gray-300 rounded-lg py-1 text-xs text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors duration-150 cursor-pointer"
        >
          + カードを追加
        </button>
      )}
    </div>
  );
}
