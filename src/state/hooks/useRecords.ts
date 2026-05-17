import { useSyncExternalStore } from "react";
import { useBattlesStore } from "../BattlesProvider";
import { selectLatestRecord } from "../selectors";

export function useRecords() {
  const store = useBattlesStore();
  const getItems = () => store.getState().records;
  const items = useSyncExternalStore(store.subscribe, getItems, getItems);
  return {
    items,
    add: store.addRecord,
    update: store.updateRecord,
    remove: store.deleteRecord,
    removeMany: store.deleteRecords,
    importRows: store.importRecords,
  };
}

export function useLatestRecord() {
  const store = useBattlesStore();
  const get = () => selectLatestRecord(store.getState());
  return useSyncExternalStore(store.subscribe, get, get);
}
