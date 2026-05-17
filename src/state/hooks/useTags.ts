import { useSyncExternalStore } from "react";
import { useBattlesStore } from "../BattlesProvider";
import { selectUsedTags } from "../selectors";

export function useTags() {
  const store = useBattlesStore();
  const get = () => store.getState().knownTags;
  const items = useSyncExternalStore(store.subscribe, get, get);
  return {
    items,
    add: store.addTag,
    rename: store.renameTag,
    remove: store.deleteTag,
  };
}

export function useUsedTags() {
  const store = useBattlesStore();
  const get = () => selectUsedTags(store.getState());
  return useSyncExternalStore(store.subscribe, get, get);
}
