import { useState } from 'react';
import type { Pattern, PatternEntry, DeckCounts, CardLabels } from '../../utils/starterRate';
import { getAllLabels, getCardsForLabel } from '../../utils/starterRate';
import Button from '../ui/Button';

export interface PatternCardProps {
  pattern: Pattern;
  deckCounts: DeckCounts;
  cardLabels: CardLabels;
  index: number;
  onRemove: () => void;
  onUpdate: (pattern: Pattern) => void;
}

type ConditionType = 'card' | 'label';

export default function PatternCard({
  pattern,
  deckCounts,
  cardLabels,
  index,
  onRemove,
  onUpdate,
}: PatternCardProps) {
  const [addingCard, setAddingCard] = useState(false);
  const [conditionType, setConditionType] = useState<ConditionType>('card');
  const [selectedCard, setSelectedCard] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [requiredCount, setRequiredCount] = useState(1);

  const usedCardNames = pattern
    .filter((e): e is Extract<PatternEntry, { type: 'card' }> => e.type === 'card')
    .map((e) => e.name);
  const usedLabels = pattern
    .filter((e): e is Extract<PatternEntry, { type: 'label' }> => e.type === 'label')
    .map((e) => e.label);

  const availableCards = Object.keys(deckCounts).filter(
    (name) => !usedCardNames.includes(name),
  );
  const allLabels = getAllLabels(cardLabels);
  const availableLabels = allLabels.filter((lbl) => !usedLabels.includes(lbl));

  function handleAddCondition() {
    if (conditionType === 'card') {
      if (!selectedCard) return;
      const maxCount = deckCounts[selectedCard] ?? 1;
      const clamped = Math.min(requiredCount, maxCount);
      onUpdate([...pattern, { type: 'card', name: selectedCard, required: clamped }]);
    } else {
      if (!selectedLabel) return;
      onUpdate([...pattern, { type: 'label', label: selectedLabel, required: requiredCount }]);
    }
    setSelectedCard('');
    setSelectedLabel('');
    setRequiredCount(1);
    setAddingCard(false);
  }

  function handleRemoveCondition(entryIndex: number) {
    onUpdate(pattern.filter((_, i) => i !== entryIndex));
  }

  function handleRequiredCountChange(entryIndex: number, value: number) {
    const entry = pattern[entryIndex];
    let clamped: number;
    if (entry.type === 'card') {
      const maxCount = deckCounts[entry.name] ?? 1;
      clamped = Math.max(1, Math.min(value, maxCount));
    } else {
      const labelMax = getCardsForLabel(entry.label, cardLabels)
        .reduce((sum, card) => sum + (deckCounts[card] ?? 0), 0);
      clamped = Math.max(1, labelMax > 0 ? Math.min(value, labelMax) : value);
    }
    onUpdate(pattern.map((e, i) => (i === entryIndex ? { ...e, required: clamped } : e)));
  }

  function handleStartAdd() {
    const firstCard = availableCards[0] ?? '';
    const firstLabel = availableLabels[0] ?? '';
    setConditionType('card');
    setSelectedCard(firstCard);
    setSelectedLabel(firstLabel);
    setRequiredCount(1);
    setAddingCard(true);
  }

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

      {pattern.length === 0 && !addingCard && (
        <p className="text-xs text-gray-400 mb-2 text-center py-2">
          カードを追加してください
        </p>
      )}

      {pattern.map((entry, i) => {
        if (entry.type === 'card') {
          const maxCount = deckCounts[entry.name] ?? 1;
          const isOverMax = entry.required > maxCount;
          return (
            <div key={i}>
              {i > 0 && (
                <div className="text-xs text-gray-400 text-center my-1">かつ</div>
              )}
              <div className="flex items-center gap-2 py-1">
                <span
                  className={`flex-1 text-sm px-2 py-0.5 rounded-full border text-xs font-medium ${
                    isOverMax
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  }`}
                >
                  {entry.name}
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
                  value={entry.required}
                  onChange={(e) => handleRequiredCountChange(i, Number(e.target.value))}
                  className="w-14 rounded-lg border border-gray-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-xs text-gray-400">枚以上</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveCondition(i)}
                  aria-label={`${entry.name}の条件を削除`}
                >
                  ✕
                </Button>
              </div>
            </div>
          );
        } else {
          const members = getCardsForLabel(entry.label, cardLabels);
          const labelMax = members.reduce((sum, card) => sum + (deckCounts[card] ?? 0), 0);
          const isEmpty = members.length === 0;
          return (
            <div key={i}>
              {i > 0 && (
                <div className="text-xs text-gray-400 text-center my-1">かつ</div>
              )}
              <div className="flex items-center gap-2 py-1">
                <span
                  className={`flex-1 text-sm px-2 py-0.5 rounded-full border text-xs font-medium ${
                    isEmpty
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-teal-50 text-teal-700 border-teal-200'
                  }`}
                >
                  🏷 {entry.label}
                  {isEmpty && (
                    <span className="ml-1 text-amber-500" title="このラベルにカードが登録されていません">
                      ⚠
                    </span>
                  )}
                </span>
                <input
                  type="number"
                  min={1}
                  max={labelMax > 0 ? labelMax : undefined}
                  value={entry.required}
                  disabled={isEmpty}
                  onChange={(e) => handleRequiredCountChange(i, Number(e.target.value))}
                  className="w-14 rounded-lg border border-gray-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
                />
                <span className="text-xs text-gray-400">枚以上</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveCondition(i)}
                  aria-label={`ラベル「${entry.label}」の条件を削除`}
                >
                  ✕
                </Button>
              </div>
            </div>
          );
        }
      })}

      {addingCard && (
        <div>
          {pattern.length > 0 && (
            <div className="text-xs text-gray-400 text-center my-1">かつ</div>
          )}
          <div className="flex flex-col gap-2 py-1">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => {
                  setConditionType('card');
                  setRequiredCount(1);
                }}
                className={`flex-1 rounded-lg py-1 text-xs font-medium border transition-colors ${
                  conditionType === 'card'
                    ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                カード
              </button>
              <button
                type="button"
                onClick={() => {
                  if (allLabels.length > 0) {
                    setConditionType('label');
                    setSelectedLabel(availableLabels[0] ?? allLabels[0]);
                    setRequiredCount(1);
                  }
                }}
                disabled={allLabels.length === 0}
                title={allLabels.length === 0 ? 'デッキエディタでカードにラベルを設定してください' : undefined}
                className={`flex-1 rounded-lg py-1 text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  conditionType === 'label'
                    ? 'bg-teal-100 text-teal-700 border-teal-300'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                ラベル
              </button>
            </div>

            <div className="flex items-center gap-2">
              {conditionType === 'card' ? (
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
              ) : (
                <select
                  value={selectedLabel}
                  onChange={(e) => setSelectedLabel(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {availableLabels.length === 0 ? (
                    <option value="">使用可能なラベルがありません</option>
                  ) : (
                    availableLabels.map((lbl) => (
                      <option key={lbl} value={lbl}>
                        {lbl}
                      </option>
                    ))
                  )}
                </select>
              )}
              <input
                type="number"
                min={1}
                max={
                  conditionType === 'card'
                    ? selectedCard
                      ? (deckCounts[selectedCard] ?? 1)
                      : 1
                    : undefined
                }
                value={requiredCount}
                onChange={(e) => setRequiredCount(Number(e.target.value))}
                className="w-14 rounded-lg border border-gray-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-xs text-gray-400">枚以上</span>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddCondition}
                disabled={
                  conditionType === 'card'
                    ? !selectedCard || availableCards.length === 0
                    : !selectedLabel || availableLabels.length === 0
                }
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
        </div>
      )}

      {!addingCard && (availableCards.length > 0 || availableLabels.length > 0) && (
        <button
          type="button"
          onClick={handleStartAdd}
          className="mt-2 w-full border border-dashed border-gray-300 rounded-lg py-1 text-xs text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors duration-150 cursor-pointer"
        >
          + 条件を追加
        </button>
      )}
    </div>
  );
}
