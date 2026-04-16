import type { AppStorage } from '../types';
import { normalizeOverlayStatSettings } from './overlayStats';

export function createDefaultStorage(): AppStorage {
  return {
    records: [],
    ownDecks: [],
    opponentDecks: [],
    knownTags: [],
    overlayStats: normalizeOverlayStatSettings(undefined),
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
  };
}
