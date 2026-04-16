import type { OverlayStatId, OverlayStatSetting } from '../types';

export interface OverlayStatDefinition {
  id: OverlayStatId;
  label: string;
}

export const OVERLAY_STAT_DEFINITIONS: OverlayStatDefinition[] = [
  { id: 'matchCount', label: '試合数' },
  { id: 'overall', label: '全体' },
  { id: 'asFirst', label: '先攻' },
  { id: 'asSecond', label: '後攻' },
  { id: 'coinToss', label: 'コイン' },
];

export function createDefaultOverlayStatSettings(): OverlayStatSetting[] {
  return OVERLAY_STAT_DEFINITIONS.map(({ id }) => ({ id, visible: true }));
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
      ({ id }) => ({ id, visible: true }),
    ),
  ];

  return isValidOverlayStatSettings(merged)
    ? merged
    : createDefaultOverlayStatSettings();
}
