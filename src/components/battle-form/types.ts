import type { BattleMode, BattleRecord, BattleResult, TurnOrder } from "../../types";
import { autoCalcDuelistsCupScore } from "./autoCalcScore";

export interface BattleFormState {
  ownDeckId: string;
  opponentDeckId: string;
  result: BattleResult | null;
  turnOrder: TurnOrder | null;
  reasonTags: string[];
  memo: string;
  battleMode: BattleMode | null;
  score: string;
}

export const EMPTY_BATTLE_FORM_STATE: BattleFormState = {
  ownDeckId: "",
  opponentDeckId: "",
  result: null,
  turnOrder: null,
  reasonTags: [],
  memo: "",
  battleMode: null,
  score: "",
};

export function isBattleFormValid(state: BattleFormState): boolean {
  return (
    state.ownDeckId !== "" &&
    state.result !== null &&
    state.turnOrder !== null
  );
}

export function applySuggestedResultToBattleForm(
  state: BattleFormState,
  suggestedResult: BattleResult,
  records: BattleRecord[],
): BattleFormState {
  if (state.battleMode === "duelists-cup" && state.score === "") {
    const autoScore = autoCalcDuelistsCupScore(suggestedResult, records);
    if (autoScore !== null) {
      return { ...state, result: suggestedResult, score: autoScore };
    }
  }

  return { ...state, result: suggestedResult };
}

export function createInitialBattleFormState(latestRecord: BattleRecord | null): BattleFormState {
  if (!latestRecord) return EMPTY_BATTLE_FORM_STATE;

  return {
    ...EMPTY_BATTLE_FORM_STATE,
    ownDeckId: latestRecord.ownDeckId,
    battleMode: latestRecord.battleMode ?? null,
  };
}

export function createNextBattleFormState(currentForm: BattleFormState): BattleFormState {
  return {
    ...EMPTY_BATTLE_FORM_STATE,
    ownDeckId: currentForm.ownDeckId,
    battleMode: currentForm.battleMode,
  };
}
