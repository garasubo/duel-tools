import { useSyncExternalStore } from "react";
import { useBattlesStore } from "../BattlesProvider";
import { selectUsedOpponentDeckIds } from "../selectors";

export function useOpponentDecks() {
  const store = useBattlesStore();
  const get = () => store.getState().opponentDecks;
  const items = useSyncExternalStore(store.subscribe, get, get);
  return {
    items,
    add: store.addOpponentDeck,
    update: store.updateOpponentDeck,
    remove: store.deleteOpponentDeck,
  };
}

export function useUsedOpponentDeckIds() {
  const store = useBattlesStore();
  const get = () => selectUsedOpponentDeckIds(store.getState());
  return useSyncExternalStore(store.subscribe, get, get);
}
