import type { Patterns, Pattern, DeckCounts, CardLabels } from '../../utils/starterRate';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import PatternCard from './PatternCard';

export interface PatternEditorProps {
  patterns: Patterns;
  deckCounts: DeckCounts;
  cardLabels: CardLabels;
  onAddPattern: () => void;
  onRemovePattern: (index: number) => void;
  onUpdatePattern: (index: number, pattern: Pattern) => void;
}

export default function PatternEditor({
  patterns,
  deckCounts,
  cardLabels,
  onAddPattern,
  onRemovePattern,
  onUpdatePattern,
}: PatternEditorProps) {
  const hasDeckCards = Object.keys(deckCounts).length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">発動条件</h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={onAddPattern}
          disabled={!hasDeckCards}
        >
          + 条件を追加
        </Button>
      </div>

      <div className="p-3 flex flex-col gap-2">
        {patterns.length === 0 && (
          <EmptyState
            title="条件がありません"
            description={
              hasDeckCards
                ? '「条件を追加」で発動条件を定義してください'
                : 'まずデッキにカードを追加してください'
            }
            className="py-8"
          />
        )}

        {patterns.map((pattern, i) => (
          <div key={i}>
            {i > 0 && (
              <div className="text-xs text-gray-400 text-center py-1 font-medium">
                または
              </div>
            )}
            <PatternCard
              pattern={pattern}
              deckCounts={deckCounts}
              cardLabels={cardLabels}
              index={i}
              onRemove={() => onRemovePattern(i)}
              onUpdate={(p) => onUpdatePattern(i, p)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
