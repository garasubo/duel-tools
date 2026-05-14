import Button from "../ui/Button";
import type { OverlayStatSetting, PanelDateFilter, PanelDateFilterType } from "../../types";
import { OVERLAY_STAT_DEFINITIONS } from "../../utils/overlayStats";

const DATE_FILTER_OPTIONS: { value: PanelDateFilterType; label: string }[] = [
  { value: 'none', label: 'なし（全期間）' },
  { value: 'today', label: '今日' },
  { value: 'last7days', label: '直近7日' },
  { value: 'last30days', label: '直近30日' },
  { value: 'since', label: '指定日以降' },
];

export interface OverlaySectionProps {
  overlayStatSettings: OverlayStatSetting[];
  onUpdate: (settings: OverlayStatSetting[]) => void;
  panelDateFilter: PanelDateFilter;
  onUpdateDateFilter: (filter: PanelDateFilter) => void;
}

export default function OverlaySection({
  overlayStatSettings,
  onUpdate,
  panelDateFilter,
  onUpdateDateFilter,
}: OverlaySectionProps) {
  const visibleCount = overlayStatSettings.filter(
    (stat) => stat.visible,
  ).length;
  const labelMap = new Map(
    OVERLAY_STAT_DEFINITIONS.map((stat) => [stat.id, stat.label]),
  );

  const moveStat = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= overlayStatSettings.length) {
      return;
    }

    const next = [...overlayStatSettings];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onUpdate(next);
  };

  const toggleVisibility = (index: number) => {
    const current = overlayStatSettings[index];
    if (current.visible && visibleCount === 1) {
      return;
    }

    const next = overlayStatSettings.map((setting, settingIndex) =>
      settingIndex === index
        ? { ...setting, visible: !setting.visible }
        : setting,
    );
    onUpdate(next);
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-700">
          オーバーレイ表示
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          表示する統計と並び順を設定します
        </p>
      </div>
      <ul className="divide-y divide-gray-100">
        {overlayStatSettings.map((setting, index) => (
          <li key={setting.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium ${
                  setting.visible ? "text-gray-800" : "text-gray-400"
                }`}
              >
                {labelMap.get(setting.id)}
              </p>
              <p className="text-xs text-gray-400">
                {setting.visible ? "表示中" : "非表示"}
              </p>
            </div>
            <Button
              size="sm"
              variant={setting.visible ? "secondary" : "ghost"}
              onClick={() => toggleVisibility(index)}
              disabled={setting.visible && visibleCount === 1}
              title={
                setting.visible && visibleCount === 1
                  ? "最低1つは表示が必要です"
                  : undefined
              }
            >
              {setting.visible ? "非表示" : "表示"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => moveStat(index, -1)}
              disabled={index === 0}
            >
              ↑
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => moveStat(index, 1)}
              disabled={index === overlayStatSettings.length - 1}
            >
              ↓
            </Button>
          </li>
        ))}
      </ul>
      <div className="px-4 py-3 border-t border-gray-100 space-y-2">
        <p className="text-xs font-medium text-gray-600">日付フィルター</p>
        <select
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={panelDateFilter.type}
          onChange={(e) =>
            onUpdateDateFilter({
              type: e.target.value as PanelDateFilterType,
              sinceDate: panelDateFilter.sinceDate,
            })
          }
        >
          {DATE_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {panelDateFilter.type === 'since' && (
          <input
            type="date"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={panelDateFilter.sinceDate ?? ''}
            onChange={(e) =>
              onUpdateDateFilter({ type: 'since', sinceDate: e.target.value })
            }
          />
        )}
      </div>
    </section>
  );
}
