import type { AppStorage, BattleRecord } from "../types";

interface DerivedSnapshot {
  latestRecord: BattleRecord | null;
  usedOwnDeckIds: ReadonlySet<string>;
  usedOpponentDeckIds: ReadonlySet<string>;
  usedTags: ReadonlySet<string>;
}

const cache = new WeakMap<AppStorage, Partial<DerivedSnapshot>>();

function getSlot(state: AppStorage): Partial<DerivedSnapshot> {
  let slot = cache.get(state);
  if (!slot) {
    slot = {};
    cache.set(state, slot);
  }
  return slot;
}

export function selectLatestRecord(state: AppStorage): BattleRecord | null {
  const slot = getSlot(state);
  if (slot.latestRecord !== undefined) return slot.latestRecord;
  const records = state.records;
  let latest: BattleRecord | null = null;
  for (const r of records) {
    if (!latest || r.createdAt > latest.createdAt) {
      latest = r;
    }
  }
  slot.latestRecord = latest;
  return latest;
}

export function selectUsedOwnDeckIds(state: AppStorage): ReadonlySet<string> {
  const slot = getSlot(state);
  if (slot.usedOwnDeckIds) return slot.usedOwnDeckIds;
  const set = new Set<string>();
  for (const r of state.records) set.add(r.ownDeckId);
  slot.usedOwnDeckIds = set;
  return set;
}

export function selectUsedOpponentDeckIds(state: AppStorage): ReadonlySet<string> {
  const slot = getSlot(state);
  if (slot.usedOpponentDeckIds) return slot.usedOpponentDeckIds;
  const set = new Set<string>();
  for (const r of state.records) {
    if (r.opponentDeckId !== "") set.add(r.opponentDeckId);
  }
  slot.usedOpponentDeckIds = set;
  return set;
}

export function selectUsedTags(state: AppStorage): ReadonlySet<string> {
  const slot = getSlot(state);
  if (slot.usedTags) return slot.usedTags;
  const set = new Set<string>();
  for (const r of state.records) {
    for (const t of r.reasonTags) set.add(t);
  }
  slot.usedTags = set;
  return set;
}
