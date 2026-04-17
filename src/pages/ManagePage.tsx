import { useBattlesContext } from "../context/BattlesContext";
import DeckSection from "../components/manage/DeckSection";
import TagSection from "../components/manage/TagSection";
import OverlaySection from "../components/manage/OverlaySection";

export default function ManagePage() {
  const {
    ownDecks,
    opponentDecks,
    knownTags,
    addOwnDeck,
    updateOwnDeck,
    deleteOwnDeck,
    addOpponentDeck,
    updateOpponentDeck,
    deleteOpponentDeck,
    addKnownTag,
    updateKnownTag,
    deleteKnownTag,
    isOwnDeckUsed,
    isOpponentDeckUsed,
    isTagUsed,
    overlayStatSettings,
    setOverlayStatSettings,
  } = useBattlesContext();

  return (
    <div className="p-4 space-y-4">
      <OverlaySection
        overlayStatSettings={overlayStatSettings}
        onUpdate={setOverlayStatSettings}
      />
      <DeckSection
        title="自分のデッキ"
        decks={ownDecks}
        onAdd={addOwnDeck}
        onUpdate={updateOwnDeck}
        onDelete={deleteOwnDeck}
        isUsed={isOwnDeckUsed}
      />
      <DeckSection
        title="相手のデッキ"
        decks={opponentDecks}
        onAdd={addOpponentDeck}
        onUpdate={updateOpponentDeck}
        onDelete={deleteOpponentDeck}
        isUsed={isOpponentDeckUsed}
      />
      <TagSection
        tags={knownTags}
        onAdd={addKnownTag}
        onUpdate={updateKnownTag}
        onDelete={deleteKnownTag}
        isTagUsed={isTagUsed}
      />
    </div>
  );
}
