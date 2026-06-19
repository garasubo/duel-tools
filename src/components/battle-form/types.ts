import type { BattleRecord, BattleResult, BattleFormState } from "../../types";
import { autoCalcDuelistsCupScore } from "./autoCalcScore";

export type { BattleFormState };

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
  options?: { skipAutoScore?: boolean },
): BattleFormState {
  // skipAutoScore: キャプチャ中の DC モードでは ±1000 見積りを入れず、画面 DP 検出に任せる。
  if (
    !options?.skipAutoScore &&
    state.battleMode === "duelists-cup" &&
    state.score === ""
  ) {
    const autoScore = autoCalcDuelistsCupScore(suggestedResult, records);
    if (autoScore !== null) {
      return { ...state, result: suggestedResult, score: autoScore };
    }
  }

  return { ...state, result: suggestedResult };
}

// 検出したスコア（レート戦=レート / DCモード=DP）を空欄時のみ反映する。手動入力は保持する。
export function applyScoreSuggestionToBattleForm(
  state: BattleFormState,
  suggestedScore: number,
): BattleFormState {
  if (
    (state.battleMode === 'rated' || state.battleMode === 'duelists-cup') &&
    state.score === ''
  ) {
    return { ...state, score: String(suggestedScore) };
  }
  return state;
}

export function applyConfirmedScoreToBattleForm(
  state: BattleFormState,
  suggestedScore: number | null,
): BattleFormState {
  return suggestedScore == null
    ? state
    : applyScoreSuggestionToBattleForm(state, suggestedScore);
}

// 結果検出だけで即確定してよいか。レート戦・DCモードはスコア（レート/DP）検出を
// 待ってから確定するため false。
export function shouldAutoSubmitSuggestedResult(state: BattleFormState): boolean {
  return state.battleMode !== 'rated' && state.battleMode !== 'duelists-cup';
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
