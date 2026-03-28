import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useBattles } from "../hooks/useBattles";

type BattlesContextValue = ReturnType<typeof useBattles>;

export const BattlesContext = createContext<BattlesContextValue | null>(null);

export function BattlesProvider({ children }: { children: ReactNode }) {
  const value = useBattles();
  return (
    <BattlesContext.Provider value={value}>{children}</BattlesContext.Provider>
  );
}

export function useBattlesContext(): BattlesContextValue {
  const ctx = useContext(BattlesContext);
  if (!ctx)
    throw new Error("useBattlesContext must be used inside BattlesProvider");
  return ctx;
}
