import { useSyncExternalStore } from "react";
import { useBattlesStore } from "../BattlesProvider";

export function useOverlaySettings() {
  const store = useBattlesStore();
  const getStats = () => store.getState().overlayStats;
  const getDateFilter = () => store.getState().panelDateFilter;
  const getIncludeGrantedFirst = () => store.getState().panelIncludeGrantedFirst;
  const stats = useSyncExternalStore(store.subscribe, getStats, getStats);
  const dateFilter = useSyncExternalStore(
    store.subscribe,
    getDateFilter,
    getDateFilter,
  );
  const includeGrantedFirst = useSyncExternalStore(
    store.subscribe,
    getIncludeGrantedFirst,
    getIncludeGrantedFirst,
  );
  return {
    stats,
    dateFilter,
    setStats: store.setOverlayStats,
    setDateFilter: store.setPanelDateFilter,
    includeGrantedFirst,
    setIncludeGrantedFirst: store.setPanelIncludeGrantedFirst,
  };
}
