import { useAppStorage } from "./useAppStorage";
import { useBattleRecords } from "./useBattleRecords";
import { useDeckManagement } from "./useDeckManagement";
import { useTagManagement } from "./useTagManagement";
import { useOverlaySettings } from "./useOverlaySettings";

export function useBattles() {
  const storage = useAppStorage();
  const battleRecords = useBattleRecords(storage);
  const deckManagement = useDeckManagement(storage);
  const tagManagement = useTagManagement(storage);
  const overlaySettings = useOverlaySettings(storage);

  return {
    ...battleRecords,
    ...deckManagement,
    ...tagManagement,
    ...overlaySettings,
  };
}
