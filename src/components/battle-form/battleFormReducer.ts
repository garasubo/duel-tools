import type { BattleRecord, BattleResult, TurnOrder } from "../../types";
import type { BattleFormState } from "./types";
import {
  applyConfirmedScoreToBattleForm,
  applyScoreSuggestionToBattleForm,
  applySuggestedResultToBattleForm,
  createNextBattleFormState,
  isBattleFormValid,
  shouldAutoSubmitSuggestedResult,
} from "./types";

// BattleForm の保存判断に関わる state を一元管理する reducer。
// 「現在の state + event だけで次状態と保存対象を決める」ことで、手動入力と
// キャプチャ由来の自動入力が近接して起きても常に最新フォームから保存する。
// captureWorkflow.ts と同じ思想（状態遷移と副作用の分離）に寄せている。
export interface BattleFormReducerState {
  form: BattleFormState;
  // reducer が「この最新フォームを保存せよ」と決めた保存対象。
  // 副作用（addRecord 等）は呼び出し側 effect が消費し、完了後 recordSaved を dispatch する。
  pendingSubmit: BattleFormState | null;
  // キャプチャ由来で勝敗だけ反映した直後の案内表示用。手動 result 変更・保存後にクリア。
  captureResultApplied: boolean;
}

// 外部の純粋入力（records / isCapturing / 検出スコア）は payload に載せて reducer を純粋に保つ。
export type BattleFormAction =
  | { type: "manualPatch"; patch: Partial<BattleFormState> }
  | {
      type: "manualResultChange";
      result: BattleResult | null;
      records: BattleRecord[];
      isCapturing: boolean;
    }
  | {
      type: "captureResultDetected";
      result: BattleResult;
      records: BattleRecord[];
      skipAutoScore: boolean;
      suggestedScore: number | null;
    }
  | {
      type: "capturePreviewResultDetected";
      result: BattleResult;
      records: BattleRecord[];
      skipAutoScore: boolean;
    }
  | { type: "captureTurnOrderDetected"; order: TurnOrder }
  | { type: "captureScoreDetected"; score: number }
  | { type: "captureScoreConfirmed"; score: number | null }
  | { type: "manualSubmitRequested" }
  | { type: "recordSaved" };

export function battleFormReducer(
  state: BattleFormReducerState,
  action: BattleFormAction,
): BattleFormReducerState {
  switch (action.type) {
    case "manualPatch":
      return { ...state, form: { ...state.form, ...action.patch } };

    case "manualResultChange": {
      // 手動 result 変更は自動反映の案内表示を消し、手動変更を尊重する。
      if (action.result === null) {
        return {
          ...state,
          captureResultApplied: false,
          form: { ...state.form, result: null },
        };
      }
      const form = applySuggestedResultToBattleForm(
        state.form,
        action.result,
        action.records,
        { skipAutoScore: action.isCapturing },
      );
      return { ...state, captureResultApplied: false, form };
    }

    case "captureResultDetected": {
      let form = applySuggestedResultToBattleForm(
        state.form,
        action.result,
        action.records,
        { skipAutoScore: action.skipAutoScore },
      );
      if (action.suggestedScore != null) {
        form = applyScoreSuggestionToBattleForm(form, action.suggestedScore);
      }
      // 非レート戦・非DCモードは勝敗確定だけで即保存（旧 autoSubmitRef/autoSubmitTick の役割）。
      const pendingSubmit =
        isBattleFormValid(form) && shouldAutoSubmitSuggestedResult(form)
          ? form
          : state.pendingSubmit;
      return { ...state, captureResultApplied: true, form, pendingSubmit };
    }

    case "capturePreviewResultDetected": {
      // プレビューは勝敗だけ反映し、自動保存はしない。
      const form = applySuggestedResultToBattleForm(
        state.form,
        action.result,
        action.records,
        { skipAutoScore: action.skipAutoScore },
      );
      return { ...state, captureResultApplied: true, form };
    }

    case "captureTurnOrderDetected":
      return { ...state, form: { ...state.form, turnOrder: action.order } };

    case "captureScoreDetected":
      // 空欄時のみ反映。手動入力済みスコアは保持する。
      return {
        ...state,
        form: applyScoreSuggestionToBattleForm(state.form, action.score),
      };

    case "captureScoreConfirmed": {
      // レート/DP 確定。最新フォーム（手動変更済みの相手デッキ等を含む）から保存対象を作る。
      const form = applyConfirmedScoreToBattleForm(state.form, action.score);
      const pendingSubmit = isBattleFormValid(form) ? form : state.pendingSubmit;
      return { ...state, form, pendingSubmit };
    }

    case "manualSubmitRequested":
      return isBattleFormValid(state.form)
        ? { ...state, pendingSubmit: state.form }
        : state;

    case "recordSaved": {
      const seed = state.pendingSubmit ?? state.form;
      return {
        form: createNextBattleFormState(seed),
        pendingSubmit: null,
        captureResultApplied: false,
      };
    }
  }
}
