import { useState, useCallback, useEffect } from "react";
import type { AppStorage } from "../types";
import { STORAGE_KEY } from "../utils/constants";
import { createDefaultStorage, normalizeStorage } from "../utils/storage";

const DEFAULT_STORAGE: AppStorage = createDefaultStorage();

function loadStorage(): AppStorage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STORAGE;
    return normalizeStorage(JSON.parse(raw));
  } catch {
    return DEFAULT_STORAGE;
  }
}

function saveStorage(storage: AppStorage): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
}

export interface AppStorageApi {
  storage: AppStorage;
  updateStorage: (updater: (prev: AppStorage) => AppStorage) => void;
}

export function useAppStorage(): AppStorageApi {
  const [storage, setStorage] = useState<AppStorage>(loadStorage);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setStorage(loadStorage());
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const updateStorage = useCallback(
    (updater: (prev: AppStorage) => AppStorage) => {
      setStorage((prev) => {
        const next = updater(prev);
        saveStorage(next);
        return next;
      });
    },
    [],
  );

  return { storage, updateStorage };
}
