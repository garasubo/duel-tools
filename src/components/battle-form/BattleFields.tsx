import type { BattleMode, BattleResult, TurnOrder, Deck } from "../../types";
import {
  BATTLE_MODE_OPTIONS,
  getScoreBounds,
  getScoreLabel,
  getScorePlaceholder,
} from "../../utils/battleMode";
import ToggleButton, { ToggleButtonGroup } from "../ui/ToggleButton";
import DeckSelect from "./DeckSelect";
import ResultSelector from "./ResultSelector";
import TurnOrderSelector from "./TurnOrderSelector";
import TagInput from "./TagInput";
import MemoInput from "./MemoInput";
import type { BattleFormState } from "./types";

export interface BattleFieldsProps {
  value: BattleFormState;
  onChange: (patch: Partial<BattleFormState>) => void;
  ownDecks: Deck[];
  opponentDecks: Deck[];
  knownTags: string[];
  onAddOwnDeck: (name: string) => void;
  onAddOpponentDeck: (name: string) => void;
  onAddKnownTag: (tag: string) => void;
  onResultChange?: (result: BattleResult) => void;
}

export default function BattleFields({
  value,
  onChange,
  ownDecks,
  opponentDecks,
  knownTags,
  onAddOwnDeck,
  onAddOpponentDeck,
  onAddKnownTag,
  onResultChange,
}: BattleFieldsProps) {
  function handleResult(result: BattleResult) {
    if (onResultChange) {
      onResultChange(result);
    } else {
      onChange({ result });
    }
  }

  function handleBattleModeChange(mode: BattleMode) {
    onChange({
      battleMode: value.battleMode === mode ? null : mode,
      score: "",
    });
  }

  const scoreLabel = getScoreLabel(value.battleMode);
  const scoreBounds =
    value.battleMode !== null ? getScoreBounds(value.battleMode) : null;

  return (
    <>
      <DeckSelect
        label="自分のデッキ"
        decks={ownDecks}
        value={value.ownDeckId}
        onChange={(id) => onChange({ ownDeckId: id })}
        onAddDeck={onAddOwnDeck}
      />

      <DeckSelect
        label="相手のデッキ"
        decks={opponentDecks}
        value={value.opponentDeckId}
        onChange={(id) => onChange({ opponentDeckId: id })}
        onAddDeck={onAddOpponentDeck}
        allowUnknown
      />

      <TurnOrderSelector
        value={value.turnOrder}
        onChange={(turnOrder: TurnOrder) => onChange({ turnOrder })}
      />

      <ResultSelector value={value.result} onChange={handleResult} />

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">対戦モード</span>
        <ToggleButtonGroup label="対戦モード選択">
          {BATTLE_MODE_OPTIONS.map((opt) => (
            <ToggleButton
              key={opt.value}
              isSelected={value.battleMode === opt.value}
              onClick={() => handleBattleModeChange(opt.value)}
            >
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>

      {value.battleMode !== null && scoreBounds && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            {scoreLabel}
          </label>
          <input
            type="number"
            value={value.score}
            onChange={(e) => onChange({ score: e.target.value })}
            placeholder={getScorePlaceholder(value.battleMode)}
            min={scoreBounds.min}
            max={scoreBounds.max}
            className="w-40 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}

      <TagInput
        tags={value.reasonTags}
        knownTags={knownTags}
        onChange={(reasonTags) => onChange({ reasonTags })}
        onAddKnownTag={onAddKnownTag}
      />

      <MemoInput
        value={value.memo}
        onChange={(memo) => onChange({ memo })}
      />
    </>
  );
}
