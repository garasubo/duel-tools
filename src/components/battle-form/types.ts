import type { BattleMode, BattleResult, TurnOrder } from "../../types";

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
