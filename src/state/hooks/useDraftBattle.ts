import { useSyncExternalStore } from "react";
import { useBattlesStore } from "../BattlesProvider";

export function useDraftBattle() {
  const store = useBattlesStore();
  const get = () => store.getDraftBattle();
  return useSyncExternalStore(store.subscribe, get, get);
}
