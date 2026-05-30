import { useCallback } from "react";
import { useOwnDecks, useUsedOwnDeckIds } from "../state/hooks/useOwnDecks";
import {
  useOpponentDecks,
  useUsedOpponentDeckIds,
} from "../state/hooks/useOpponentDecks";
import { useTags, useUsedTags } from "../state/hooks/useTags";
import { useOverlaySettings } from "../state/hooks/useOverlaySettings";
import DeckSection from "../components/manage/DeckSection";
import TagSection from "../components/manage/TagSection";
import OverlaySection from "../components/manage/OverlaySection";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function ManagePage() {
  useDocumentTitle("管理 | 戦績記録 - duel-tools");
  const ownDecks = useOwnDecks();
  const opponentDecks = useOpponentDecks();
  const tags = useTags();
  const overlay = useOverlaySettings();

  const usedOwnDeckIds = useUsedOwnDeckIds();
  const usedOpponentDeckIds = useUsedOpponentDeckIds();
  const usedTags = useUsedTags();

  const isOwnDeckUsed = useCallback(
    (id: string) => usedOwnDeckIds.has(id),
    [usedOwnDeckIds],
  );
  const isOpponentDeckUsed = useCallback(
    (id: string) => usedOpponentDeckIds.has(id),
    [usedOpponentDeckIds],
  );
  const isTagUsed = useCallback((tag: string) => usedTags.has(tag), [usedTags]);

  return (
    <div className="p-4 space-y-4">
      <OverlaySection
        overlayStatSettings={overlay.stats}
        onUpdate={overlay.setStats}
        panelDateFilter={overlay.dateFilter}
        onUpdateDateFilter={overlay.setDateFilter}
      />
      <DeckSection
        title="自分のデッキ"
        decks={ownDecks.items}
        onAdd={ownDecks.add}
        onUpdate={ownDecks.update}
        onDelete={ownDecks.remove}
        isUsed={isOwnDeckUsed}
      />
      <DeckSection
        title="相手のデッキ"
        decks={opponentDecks.items}
        onAdd={opponentDecks.add}
        onUpdate={opponentDecks.update}
        onDelete={opponentDecks.remove}
        isUsed={isOpponentDeckUsed}
      />
      <TagSection
        tags={tags.items}
        onAdd={tags.add}
        onUpdate={tags.rename}
        onDelete={tags.remove}
        isTagUsed={isTagUsed}
      />
    </div>
  );
}
