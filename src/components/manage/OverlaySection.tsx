import Button from "../ui/Button";
import type { OverlayStatSetting } from "../../types";
import { OVERLAY_STAT_DEFINITIONS } from "../../utils/overlayStats";

export interface OverlaySectionProps {
  overlayStatSettings: OverlayStatSetting[];
  onUpdate: (settings: OverlayStatSetting[]) => void;
}

export default function OverlaySection({
  overlayStatSettings,
  onUpdate,
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
    </section>
  );
}
