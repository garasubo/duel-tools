import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppStorage, DraftBattle } from "../types";
import { DRAFT_BATTLE_KEY, STORAGE_KEY } from "../utils/constants";
import { createDefaultStorage } from "../utils/storage";
import { createBattlesStore } from "./store";
import type { StorageLike } from "./store";

interface MockStorage extends StorageLike {
  failSetFor(key: string): void;
  failRemoveFor(key: string): void;
}

function createStorage(initialValues: Record<string, string> = {}): MockStorage {
  const values = new Map(Object.entries(initialValues));
  const failingSetKeys = new Set<string>();
  const failingRemoveKeys = new Set<string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failingSetKeys.has(key)) {
        throw new Error(`set failed: ${key}`);
      }
      values.set(key, value);
    },
    removeItem: (key: string) => {
      if (failingRemoveKeys.has(key)) {
        throw new Error(`remove failed: ${key}`);
      }
      values.delete(key);
    },
    failSetFor: (key: string) => {
      failingSetKeys.add(key);
    },
    failRemoveFor: (key: string) => {
      failingRemoveKeys.add(key);
    },
  };
}

function storageJson(overrides: Partial<AppStorage> = {}): string {
  return JSON.stringify({ ...createDefaultStorage(), ...overrides });
}

function draftJson(value: DraftBattle): string {
  return JSON.stringify(value);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createBattlesStore", () => {
  it("生成時に window の storage event を購読しない", () => {
    const addEventListener = vi.fn();
    vi.stubGlobal("window", {
      localStorage: createStorage(),
      addEventListener,
      removeEventListener: vi.fn(),
    });

    createBattlesStore();

    expect(addEventListener).not.toHaveBeenCalled();
  });

  it("storage 保存が失敗した場合は state を進めず通知しない", () => {
    const storage = createStorage({
      [STORAGE_KEY]: storageJson({ knownTags: ["既存"] }),
    });
    storage.failSetFor(STORAGE_KEY);
    const store = createBattlesStore({ storage });
    const listener = vi.fn();
    store.subscribe(listener);

    expect(() => store.addTag("新規")).toThrow("set failed");

    expect(store.getState().knownTags).toEqual(["既存"]);
    expect(listener).not.toHaveBeenCalled();
  });

  it("draft 保存が失敗した場合は draft を進めず通知しない", () => {
    const storage = createStorage();
    storage.failSetFor(DRAFT_BATTLE_KEY);
    const store = createBattlesStore({ storage });
    const listener = vi.fn();
    store.subscribe(listener);

    expect(() =>
      store.setDraftBattle({ turnOrder: "first", result: null }),
    ).toThrow("set failed");

    expect(store.getDraftBattle()).toEqual({ turnOrder: null, result: null });
    expect(listener).not.toHaveBeenCalled();
  });

  it("draft 削除が失敗した場合は draft を進めず通知しない", () => {
    const storage = createStorage({
      [DRAFT_BATTLE_KEY]: draftJson({ turnOrder: "first", result: "win" }),
    });
    storage.failRemoveFor(DRAFT_BATTLE_KEY);
    const store = createBattlesStore({ storage });
    const listener = vi.fn();
    store.subscribe(listener);

    expect(() =>
      store.setDraftBattle({ turnOrder: null, result: null }),
    ).toThrow("remove failed");

    expect(store.getDraftBattle()).toEqual({ turnOrder: "first", result: "win" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("外部 storage 変更を state に同期する", () => {
    const storage = createStorage({
      [STORAGE_KEY]: storageJson({ knownTags: ["旧"] }),
    });
    const store = createBattlesStore({ storage });
    const listener = vi.fn();
    store.subscribe(listener);

    storage.setItem(STORAGE_KEY, storageJson({ knownTags: ["新"] }));
    store.syncExternalStorageChange(STORAGE_KEY);

    expect(store.getState().knownTags).toEqual(["新"]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("外部 draft 変更を draft に同期する", () => {
    const storage = createStorage();
    const store = createBattlesStore({ storage });
    const listener = vi.fn();
    store.subscribe(listener);

    storage.setItem(DRAFT_BATTLE_KEY, draftJson({ turnOrder: "second", result: "loss" }));
    store.syncExternalStorageChange(DRAFT_BATTLE_KEY);

    expect(store.getDraftBattle()).toEqual({ turnOrder: "second", result: "loss" });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
