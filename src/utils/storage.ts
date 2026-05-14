import type { AppStorage, PanelDateFilter, PanelDateFilterType } from '../types';
import { normalizeOverlayStatSettings } from './overlayStats';

const PANEL_DATE_FILTER_TYPES: PanelDateFilterType[] = ['none', 'today', 'last7days', 'last30days', 'since'];

function normalizePanelDateFilter(value: unknown): PanelDateFilter {
  if (typeof value !== 'object' || value === null) return { type: 'none' };
  const v = value as Record<string, unknown>;
  const type = PANEL_DATE_FILTER_TYPES.includes(v.type as PanelDateFilterType)
    ? (v.type as PanelDateFilterType)
    : 'none';
  const sinceDate = typeof v.sinceDate === 'string' ? v.sinceDate : undefined;
  return { type, sinceDate };
}

export function createDefaultStorage(): AppStorage {
  return {
    records: [],
    ownDecks: [],
    opponentDecks: [],
    knownTags: [],
    overlayStats: normalizeOverlayStatSettings(undefined),
    panelDateFilter: { type: 'none' },
  };
}

export function normalizeStorage(value: unknown): AppStorage {
  const defaults = createDefaultStorage();

  if (typeof value !== 'object' || value === null) {
    return defaults;
  }

  const parsed = value as Partial<AppStorage>;
  return {
    records: Array.isArray(parsed.records) ? parsed.records : defaults.records,
    ownDecks: Array.isArray(parsed.ownDecks)
      ? parsed.ownDecks
      : defaults.ownDecks,
    opponentDecks: Array.isArray(parsed.opponentDecks)
      ? parsed.opponentDecks
      : defaults.opponentDecks,
    knownTags: Array.isArray(parsed.knownTags)
      ? parsed.knownTags
      : defaults.knownTags,
    overlayStats: normalizeOverlayStatSettings(parsed.overlayStats),
    panelDateFilter: normalizePanelDateFilter(parsed.panelDateFilter),
  };
}
