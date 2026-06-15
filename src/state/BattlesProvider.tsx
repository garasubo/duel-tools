import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createBattlesStore, type BattlesStore } from "./store";

// eslint-disable-next-line react-refresh/only-export-components
export const BattlesStoreContext = createContext<BattlesStore | null>(null);

export function BattlesProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createBattlesStore);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorage = (event: StorageEvent) => {
      store.syncExternalStorageChange(event.key);
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [store]);

  return (
    <BattlesStoreContext.Provider value={store}>
      {children}
    </BattlesStoreContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBattlesStore(): BattlesStore {
  const store = useContext(BattlesStoreContext);
  if (!store) {
    throw new Error("useBattlesStore must be used inside BattlesProvider");
  }
  return store;
}
