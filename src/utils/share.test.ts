import { describe, expect, it } from 'vitest';
import {
  buildSharedSnapshot,
  normalizeSharedSnapshot,
  sharedSnapshotToAppStorage,
} from './share';
import { createDefaultStorage } from './storage';
import type { AppStorage, BattleRecord } from '../types';

function makeRecord(overrides: Partial<BattleRecord> = {}): BattleRecord {
  return {
    id: 'r1',
    createdAt: '2026-07-01T10:00:00.000Z',
    ownDeckId: 'own-1',
    opponentDeckId: 'opp-1',
    result: 'win',
    turnOrder: 'first',
    reasonTags: ['先攻有利'],
    memo: 'メモ',
    ...overrides,
  };
}

function makeState(overrides: Partial<AppStorage> = {}): AppStorage {
  return {
    ...createDefaultStorage(),
    records: [makeRecord()],
    ownDecks: [
      { id: 'own-1', name: '自デッキA' },
      { id: 'own-unused', name: '未使用自デッキ' },
    ],
    opponentDecks: [
      { id: 'opp-1', name: '相手デッキX' },
      { id: 'opp-unused', name: '未使用相手デッキ' },
    ],
    knownTags: ['先攻有利', '未使用タグ'],
    ...overrides,
  };
}

describe('buildSharedSnapshot', () => {
  it('version と records を含む自己完結スナップショットを作る', () => {
    const snap = buildSharedSnapshot(makeState());
    expect(snap.version).toBe(1);
    expect(snap.records).toHaveLength(1);
    expect(typeof snap.createdAt).toBe('string');
  });

  it('記録から参照されているデッキだけを含める', () => {
    const snap = buildSharedSnapshot(makeState());
    expect(snap.ownDecks.map((d) => d.id)).toEqual(['own-1']);
    expect(snap.opponentDecks.map((d) => d.id)).toEqual(['opp-1']);
  });

  it('実際に使われているタグだけを含める', () => {
    const snap = buildSharedSnapshot(makeState());
    expect(snap.knownTags).toEqual(['先攻有利']);
  });

  it('相手デッキ不明(空文字)の記録では相手デッキを含めない', () => {
    const snap = buildSharedSnapshot(
      makeState({ records: [makeRecord({ opponentDeckId: '' })] }),
    );
    expect(snap.opponentDecks).toEqual([]);
  });
});

describe('normalizeSharedSnapshot', () => {
  it('build したスナップショットをラウンドトリップできる', () => {
    const snap = buildSharedSnapshot(makeState());
    const roundTripped = normalizeSharedSnapshot(JSON.parse(JSON.stringify(snap)));
    expect(roundTripped).toEqual(snap);
  });

  it('version が 1 でなければ null', () => {
    expect(normalizeSharedSnapshot({ version: 2, records: [] })).toBeNull();
  });

  it('オブジェクトでなければ null', () => {
    expect(normalizeSharedSnapshot(null)).toBeNull();
    expect(normalizeSharedSnapshot('x')).toBeNull();
  });

  it('必須配列が欠けていれば null', () => {
    expect(
      normalizeSharedSnapshot({ version: 1, records: [], ownDecks: [] }),
    ).toBeNull();
  });

  it('不正な record は要素単位でスキップする', () => {
    const snap = {
      version: 1,
      createdAt: '2026-07-01T10:00:00.000Z',
      records: [
        makeRecord(),
        { id: 'bad', result: 'invalid' }, // 不正
      ],
      ownDecks: [{ id: 'own-1', name: '自デッキA' }],
      opponentDecks: [{ id: 'opp-1', name: '相手デッキX' }],
      knownTags: ['先攻有利'],
    };
    const result = normalizeSharedSnapshot(snap);
    expect(result?.records).toHaveLength(1);
    expect(result?.records[0].id).toBe('r1');
  });

  it('battleMode と score を保持する', () => {
    const snap = buildSharedSnapshot(
      makeState({
        records: [makeRecord({ battleMode: 'rated', score: 1500 })],
      }),
    );
    const result = normalizeSharedSnapshot(JSON.parse(JSON.stringify(snap)));
    expect(result?.records[0].battleMode).toBe('rated');
    expect(result?.records[0].score).toBe(1500);
  });
});

describe('sharedSnapshotToAppStorage', () => {
  it('records/decks/tags を AppStorage に展開し、個人設定は既定値にする', () => {
    const snap = buildSharedSnapshot(makeState());
    const storage = sharedSnapshotToAppStorage(snap);
    expect(storage.records).toEqual(snap.records);
    expect(storage.ownDecks).toEqual(snap.ownDecks);
    expect(storage.opponentDecks).toEqual(snap.opponentDecks);
    expect(storage.knownTags).toEqual(snap.knownTags);
    expect(storage.overlayStats).toEqual(createDefaultStorage().overlayStats);
    expect(storage.panelDateFilter).toEqual(createDefaultStorage().panelDateFilter);
  });
});
