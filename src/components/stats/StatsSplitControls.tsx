import type { StatsSplitMode } from '../../hooks/useStats';

const MODE_OPTIONS: { value: StatsSplitMode; label: string }[] = [
  { value: 'coin', label: 'コイン表/裏' },
  { value: 'turn', label: '先攻/後攻' },
];

interface StatsSplitControlsProps {
  idPrefix: string;
  mode: StatsSplitMode;
  onModeChange: (mode: StatsSplitMode) => void;
  includeGrantedFirst: boolean;
  onIncludeGrantedFirstChange: (value: boolean) => void;
}

export default function StatsSplitControls({
  idPrefix,
  mode,
  onModeChange,
  includeGrantedFirst,
  onIncludeGrantedFirstChange,
}: StatsSplitControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">内訳</span>
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={mode === opt.value}
              onClick={() => onModeChange(opt.value)}
              className={`text-sm px-3 py-1 transition-colors ${
                mode === opt.value
                  ? 'bg-brand-action text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {mode === 'turn' && (
        <div className="flex items-center gap-2">
          <input
            id={`${idPrefix}-include-granted-first`}
            type="checkbox"
            checked={includeGrantedFirst}
            onChange={(e) => onIncludeGrantedFirstChange(e.target.checked)}
            className="w-4 h-4 accent-brand-action"
          />
          <label
            htmlFor={`${idPrefix}-include-granted-first`}
            className="text-sm text-gray-600 select-none cursor-pointer"
          >
            ゆずられ先攻を先攻に含める
          </label>
        </div>
      )}
    </div>
  );
}
