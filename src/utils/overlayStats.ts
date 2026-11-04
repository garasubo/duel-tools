import type { OverlayStatId, OverlayStatSetting } from '../types';

export interface OverlayStatDefinition {
  id: OverlayStatId;
  label: string;
  // 初期状態・旧設定への補完時に表示するか（未指定は表示）
  defaultVisible?: boolean;
}

export const OVERLAY_STAT_DEFINITIONS: OverlayStatDefinition[] = [
  { id: 'matchCount', label: '試合数' },
  { id: 'overall', label: '全体' },
  { id: 'asFirst', label: '先攻' },
  { id: 'asSecond', label: '後攻' },
  { id: 'coinToss', label: 'コイン' },
  { id: 'coinHeads', label: 'コイン表', defaultVisible: false },
  { id: 'coinTails', label: 'コイン裏', defaultVisible: false },
];

export function createDefaultOverlayStatSettings(): OverlayStatSetting[] {
  return OVERLAY_STAT_DEFINITIONS.map(({ id, defaultVisible }) => ({
    id,
    visible: defaultVisible ?? true,
  }));
}

export function isOverlayStatId(value: unknown): value is OverlayStatId {
  return OVERLAY_STAT_DEFINITIONS.some((stat) => stat.id === value);
}

export function isValidOverlayStatSettings(
  settings: OverlayStatSetting[],
): boolean {
  if (settings.length !== OVERLAY_STAT_DEFINITIONS.length) {
    return false;
  }

  const seen = new Set<OverlayStatId>();
  let visibleCount = 0;

  for (const setting of settings) {
    if (!isOverlayStatId(setting.id) || seen.has(setting.id)) {
      return false;
    }
    seen.add(setting.id);
    if (setting.visible) {
      visibleCount += 1;
    }
  }

  return visibleCount > 0;
}

export function normalizeOverlayStatSettings(
  value: unknown,
): OverlayStatSetting[] {
  if (!Array.isArray(value)) {
    return createDefaultOverlayStatSettings();
  }

  const parsed: OverlayStatSetting[] = [];
  const seen = new Set<OverlayStatId>();
  for (const item of value) {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('id' in item) ||
      !('visible' in item)
    ) {
      return createDefaultOverlayStatSettings();
    }

    const { id, visible } = item as { id: unknown; visible: unknown };
    if (
      !isOverlayStatId(id) ||
      typeof visible !== 'boolean' ||
      seen.has(id)
    ) {
      return createDefaultOverlayStatSettings();
    }

    seen.add(id);
    parsed.push({ id, visible });
  }

  const merged = [
    ...parsed,
    ...OVERLAY_STAT_DEFINITIONS.filter((stat) => !seen.has(stat.id)).map(
      ({ id, defaultVisible }) => ({ id, visible: defaultVisible ?? true }),
    ),
  ];

  return isValidOverlayStatSettings(merged)
    ? merged
    : createDefaultOverlayStatSettings();
}
