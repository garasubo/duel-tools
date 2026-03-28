import type { Deck, BattleResult, TurnOrder } from '../../types';
import type { FilterState } from '../../hooks/useFilter';
import ToggleButton, { ToggleButtonGroup } from '../ui/ToggleButton';
import Button from '../ui/Button';

const RESULT_OPTIONS: { value: BattleResult; label: string }[] = [
  { value: 'win', label: '勝ち' },
  { value: 'loss', label: '負け' },
  { value: 'draw', label: '引き分け' },
];

const TURN_ORDER_OPTIONS: { value: TurnOrder; label: string }[] = [
  { value: 'first', label: '先行' },
  { value: 'second', label: '後攻' },
];

export interface FilterBarProps {
  filter: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  onReset: () => void;
  ownDecks: Deck[];
  opponentDecks: Deck[];
}

export default function FilterBar({
  filter,
  onChange,
  onReset,
  ownDecks,
  opponentDecks,
}: FilterBarProps) {
  const isActive =
    filter.ownDeckId !== '' ||
    filter.opponentDeckId !== '' ||
    filter.result !== '' ||
    filter.turnOrder !== '' ||
    filter.dateFrom !== '' ||
    filter.dateTo !== '';

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">絞り込み</span>
        {isActive && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            リセット
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">自分のデッキ</label>
          <select
            value={filter.ownDeckId}
            onChange={(e) => onChange({ ownDeckId: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">すべて</option>
            {ownDecks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">相手のデッキ</label>
          <select
            value={filter.opponentDeckId}
            onChange={(e) => onChange({ opponentDeckId: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">すべて</option>
            {opponentDecks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-600">勝敗</span>
        <ToggleButtonGroup label="勝敗フィルタ" className="flex-wrap">
          {RESULT_OPTIONS.map((opt) => (
            <ToggleButton
              key={opt.value}
              isSelected={filter.result === opt.value}
              onClick={() =>
                onChange({ result: filter.result === opt.value ? '' : opt.value })
              }
            >
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-600">手番</span>
        <ToggleButtonGroup label="手番フィルタ">
          {TURN_ORDER_OPTIONS.map((opt) => (
            <ToggleButton
              key={opt.value}
              isSelected={filter.turnOrder === opt.value}
              onClick={() =>
                onChange({ turnOrder: filter.turnOrder === opt.value ? '' : opt.value })
              }
            >
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">期間（開始）</label>
          <input
            type="date"
            value={filter.dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">期間（終了）</label>
          <input
            type="date"
            value={filter.dateTo}
            onChange={(e) => onChange({ dateTo: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
}
