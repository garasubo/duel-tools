import { useCallback } from "react";
import type { OverlayStatSetting, PanelDateFilter } from "../types";
import { isValidOverlayStatSettings } from "../utils/overlayStats";
import type { AppStorageApi } from "./useAppStorage";

export function useOverlaySettings({ storage, updateStorage }: AppStorageApi) {
  const setOverlayStatSettings = useCallback(
    (overlayStats: OverlayStatSetting[]) => {
      if (!isValidOverlayStatSettings(overlayStats)) {
        throw new Error("Invalid overlay stat settings");
      }

      updateStorage((prev) => ({
        ...prev,
        overlayStats,
      }));
    },
    [updateStorage],
  );

  const setPanelDateFilter = useCallback(
    (panelDateFilter: PanelDateFilter) => {
      updateStorage((prev) => ({ ...prev, panelDateFilter }));
    },
    [updateStorage],
  );

  return {
    overlayStatSettings: storage.overlayStats,
    setOverlayStatSettings,
    panelDateFilter: storage.panelDateFilter,
    setPanelDateFilter,
  };
}
