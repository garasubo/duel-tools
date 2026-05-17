import { useSyncExternalStore } from "react";
import { useBattlesStore } from "../BattlesProvider";
import { selectUsedOwnDeckIds } from "../selectors";

export function useOwnDecks() {
  const store = useBattlesStore();
  const get = () => store.getState().ownDecks;
  const items = useSyncExternalStore(store.subscribe, get, get);
  return {
    items,
    add: store.addOwnDeck,
    update: store.updateOwnDeck,
    remove: store.deleteOwnDeck,
  };
}

export function useUsedOwnDeckIds() {
  const store = useBattlesStore();
  const get = () => selectUsedOwnDeckIds(store.getState());
  return useSyncExternalStore(store.subscribe, get, get);
}
