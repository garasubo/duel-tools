import { createContext, useContext } from 'react';
import type { useBattles } from '../hooks/useBattles';

type BattlesContextValue = ReturnType<typeof useBattles>;

export const BattlesContext = createContext<BattlesContextValue | null>(null);

export function useBattlesContext(): BattlesContextValue {
  const ctx = useContext(BattlesContext);
  if (!ctx) throw new Error('useBattlesContext must be used inside BattlesProvider');
  return ctx;
}
