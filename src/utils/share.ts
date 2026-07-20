import type {
  AppStorage,
  BattleMode,
  BattleRecord,
  BattleResult,
  Deck,
  SharedSnapshot,
  TurnOrder,
} from '../types';
import { createDefaultStorage } from './storage';
import {
  selectUsedOpponentDeckIds,
  selectUsedOwnDeckIds,
  selectUsedTags,
} from '../state/selectors';

const RESULTS: BattleResult[] = ['win', 'loss'];
const TURN_ORDERS: TurnOrder[] = ['first', 'second', 'third'];
const BATTLE_MODES: BattleMode[] = ['duelists-cup', 'rated'];

/**
 * ローカルの全記録から自己完結な共有スナップショットを作る。
 * 記録で実際に参照されているデッキ・タグだけを埋め込み、未使用のものは載せない。
 */
export function buildSharedSnapshot(state: AppStorage): SharedSnapshot {
  const usedOwn = selectUsedOwnDeckIds(state);
  const usedOpponent = selectUsedOpponentDeckIds(state);
  const usedTags = selectUsedTags(state);

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    records: state.records.map((r) => ({ ...r })),
    ownDecks: state.ownDecks.filter((d) => usedOwn.has(d.id)),
    opponentDecks: state.opponentDecks.filter((d) => usedOpponent.has(d.id)),
    knownTags: [...usedTags],
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function normalizeDeck(value: unknown): Deck | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.name !== 'string') return null;
  return { id: v.id, name: v.name };
}

function normalizeRecord(value: unknown): BattleRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.id !== 'string' ||
    typeof v.createdAt !== 'string' ||
    typeof v.ownDeckId !== 'string' ||
    typeof v.opponentDeckId !== 'string' ||
    typeof v.memo !== 'string' ||
    !RESULTS.includes(v.result as BattleResult) ||
    !TURN_ORDERS.includes(v.turnOrder as TurnOrder) ||
    !isStringArray(v.reasonTags)
  ) {
    return null;
  }

  const record: BattleRecord = {
    id: v.id,
    createdAt: v.createdAt,
    ownDeckId: v.ownDeckId,
    opponentDeckId: v.opponentDeckId,
    result: v.result as BattleResult,
    turnOrder: v.turnOrder as TurnOrder,
    reasonTags: v.reasonTags,
    memo: v.memo,
  };

  if (BATTLE_MODES.includes(v.battleMode as BattleMode)) {
    record.battleMode = v.battleMode as BattleMode;
  }
  if (typeof v.score === 'number' && Number.isFinite(v.score)) {
    record.score = v.score;
  }

  return record;
}

/**
 * Worker から取得した JSON を検証しつつ SharedSnapshot に復元する。
 * 壊れているデータは要素単位でスキップし、致命的に不正なら null を返す。
 */
export function normalizeSharedSnapshot(value: unknown): SharedSnapshot | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.version !== 1) return null;
  if (
    !Array.isArray(v.records) ||
    !Array.isArray(v.ownDecks) ||
    !Array.isArray(v.opponentDecks) ||
    !isStringArray(v.knownTags)
  ) {
    return null;
  }

  const records = v.records
    .map(normalizeRecord)
    .filter((r): r is BattleRecord => r !== null);
  const ownDecks = v.ownDecks
    .map(normalizeDeck)
    .filter((d): d is Deck => d !== null);
  const opponentDecks = v.opponentDecks
    .map(normalizeDeck)
    .filter((d): d is Deck => d !== null);

  return {
    version: 1,
    createdAt: typeof v.createdAt === 'string' ? v.createdAt : '',
    records,
    ownDecks,
    opponentDecks,
    knownTags: v.knownTags,
  };
}

/**
 * 閲覧用に SharedSnapshot を AppStorage 形状へ展開する。
 * overlayStats / panelDateFilter は既定値のまま（共有には含めない）。
 */
export function sharedSnapshotToAppStorage(snapshot: SharedSnapshot): AppStorage {
  return {
    ...createDefaultStorage(),
    records: snapshot.records,
    ownDecks: snapshot.ownDecks,
    opponentDecks: snapshot.opponentDecks,
    knownTags: snapshot.knownTags,
  };
}
