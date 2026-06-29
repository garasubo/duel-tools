import { describe, expect, it } from "vitest";
import { battleFormReducer } from "./battleFormReducer";
import type { BattleFormReducerState } from "./battleFormReducer";
import { EMPTY_BATTLE_FORM_STATE } from "./types";
import type { BattleFormState } from "./types";
import type { BattleRecord } from "../../types";

function makeState(
  form: Partial<BattleFormState>,
  rest: Partial<Omit<BattleFormReducerState, "form">> = {},
): BattleFormReducerState {
  return {
    form: { ...EMPTY_BATTLE_FORM_STATE, ...form },
    pendingSubmit: null,
    captureResultApplied: false,
    ...rest,
  };
}

// valid（own/result/turnOrder が揃った）レート戦フォーム。相手デッキは手動変更済み。
const ratedValidManualOpponent: BattleFormState = {
  ...EMPTY_BATTLE_FORM_STATE,
  ownDeckId: "own-1",
  opponentDeckId: "opponent-manual",
  result: "win",
  turnOrder: "first",
  battleMode: "rated",
};

const dcValidManualOpponent: BattleFormState = {
  ...EMPTY_BATTLE_FORM_STATE,
  ownDeckId: "own-1",
  opponentDeckId: "opponent-manual",
  result: "loss",
  turnOrder: "second",
  battleMode: "duelists-cup",
};

describe("battleFormReducer", () => {
  describe("captureScoreConfirmed（レート/DP 確定）は最新フォームから保存対象を作る", () => {
    it("手動で相手デッキを変えた直後に rating-confirmed が来ても新しい相手デッキで保存される", () => {
      const next = battleFormReducer(makeState(ratedValidManualOpponent), {
        type: "captureScoreConfirmed",
        score: 1510,
      });

      expect(next.pendingSubmit).not.toBeNull();
      expect(next.pendingSubmit?.opponentDeckId).toBe("opponent-manual");
      expect(next.pendingSubmit?.score).toBe("1510");
      expect(next.form.score).toBe("1510");
    });

    it("手動で相手デッキを変えた直後に dp-confirmed が来ても新しい相手デッキで保存される", () => {
      const next = battleFormReducer(makeState(dcValidManualOpponent), {
        type: "captureScoreConfirmed",
        score: 51000,
      });

      expect(next.pendingSubmit?.opponentDeckId).toBe("opponent-manual");
      expect(next.pendingSubmit?.score).toBe("51000");
    });

    it("手動入力済みスコアは確定で上書きしない", () => {
      const next = battleFormReducer(
        makeState({ ...dcValidManualOpponent, score: "49000" }),
        { type: "captureScoreConfirmed", score: 48000 },
      );

      expect(next.pendingSubmit?.score).toBe("49000");
    });

    it("未入力（invalid）なら確定でも保存対象を立てない", () => {
      const next = battleFormReducer(
        makeState({ ownDeckId: "own-1", battleMode: "rated" }),
        { type: "captureScoreConfirmed", score: 1510 },
      );

      expect(next.pendingSubmit).toBeNull();
      expect(next.form.score).toBe("1510");
    });
  });

  describe("captureScoreDetected（検出スコアの空欄反映）", () => {
    it("スコア未入力なら反映する", () => {
      const next = battleFormReducer(
        makeState({ battleMode: "rated" }),
        { type: "captureScoreDetected", score: 1501 },
      );
      expect(next.form.score).toBe("1501");
    });

    it("手動入力済みなら上書きしない", () => {
      const next = battleFormReducer(
        makeState({ battleMode: "rated", score: "1450" }),
        { type: "captureScoreDetected", score: 1501 },
      );
      expect(next.form.score).toBe("1450");
    });
  });

  describe("captureResultDetected（勝敗の自動検出）", () => {
    it("対戦モード未選択で valid なら即保存対象を立てる（自動送信）", () => {
      const next = battleFormReducer(
        makeState({ ownDeckId: "own-1", turnOrder: "first" }),
        {
          type: "captureResultDetected",
          result: "win",
          records: [],
          skipAutoScore: false,
          suggestedScore: null,
        },
      );

      expect(next.form.result).toBe("win");
      expect(next.captureResultApplied).toBe(true);
      expect(next.pendingSubmit?.result).toBe("win");
    });

    it("レート戦は勝敗確定だけでは保存対象を立てない（スコア確定待ち）", () => {
      const next = battleFormReducer(
        makeState({ ownDeckId: "own-1", turnOrder: "first", battleMode: "rated" }),
        {
          type: "captureResultDetected",
          result: "win",
          records: [],
          skipAutoScore: false,
          suggestedScore: null,
        },
      );

      expect(next.form.result).toBe("win");
      expect(next.pendingSubmit).toBeNull();
    });

    it("DCモードも勝敗確定だけでは保存対象を立てない（DP 確定待ち）", () => {
      const next = battleFormReducer(
        makeState({
          ownDeckId: "own-1",
          turnOrder: "first",
          battleMode: "duelists-cup",
        }),
        {
          type: "captureResultDetected",
          result: "loss",
          records: [],
          skipAutoScore: false,
          suggestedScore: null,
        },
      );

      expect(next.pendingSubmit).toBeNull();
    });

    it("suggestedScore が来ていれば空欄時に同時反映する", () => {
      const next = battleFormReducer(
        makeState({ ownDeckId: "own-1", turnOrder: "first", battleMode: "rated" }),
        {
          type: "captureResultDetected",
          result: "win",
          records: [],
          skipAutoScore: false,
          suggestedScore: 1530,
        },
      );

      expect(next.form.score).toBe("1530");
    });
  });

  describe("自動検出後の手動 result 変更を尊重する", () => {
    it("レート戦で result 自動検出後に手動で loss に変えると、確定時の保存も loss", () => {
      // 1) 勝敗自動検出（rated なので保存対象は立たない）
      const afterDetect = battleFormReducer(
        makeState({ ownDeckId: "own-1", turnOrder: "first", battleMode: "rated" }),
        {
          type: "captureResultDetected",
          result: "win",
          records: [],
          skipAutoScore: false,
          suggestedScore: null,
        },
      );
      expect(afterDetect.form.result).toBe("win");

      // 2) 自動保存直前にユーザーが手動で loss へ
      const afterManual = battleFormReducer(afterDetect, {
        type: "manualResultChange",
        result: "loss",
        records: [],
        isCapturing: true,
      });
      expect(afterManual.form.result).toBe("loss");
      expect(afterManual.captureResultApplied).toBe(false);

      // 3) スコア確定 → 手動変更後の loss で保存される
      const afterConfirm = battleFormReducer(afterManual, {
        type: "captureScoreConfirmed",
        score: 1490,
      });
      expect(afterConfirm.pendingSubmit?.result).toBe("loss");
    });

    it("manualResultChange(null) は result をクリアし案内表示も消す", () => {
      const next = battleFormReducer(
        makeState({ result: "win" }, { captureResultApplied: true }),
        { type: "manualResultChange", result: null, records: [], isCapturing: false },
      );
      expect(next.form.result).toBeNull();
      expect(next.captureResultApplied).toBe(false);
    });
  });

  describe("manualSubmitRequested", () => {
    it("valid なら最新フォームを保存対象に立てる", () => {
      const next = battleFormReducer(makeState(ratedValidManualOpponent), {
        type: "manualSubmitRequested",
      });
      expect(next.pendingSubmit?.opponentDeckId).toBe("opponent-manual");
    });

    it("invalid なら何もしない", () => {
      const state = makeState({ ownDeckId: "own-1" });
      const next = battleFormReducer(state, { type: "manualSubmitRequested" });
      expect(next).toBe(state);
    });
  });

  describe("recordSaved", () => {
    it("次の試合用フォームに戻し、保存対象と案内表示をクリアする", () => {
      const submitted: BattleFormState = {
        ...ratedValidManualOpponent,
        score: "1510",
      };
      const next = battleFormReducer(
        makeState(EMPTY_BATTLE_FORM_STATE, {
          pendingSubmit: submitted,
          captureResultApplied: true,
        }),
        { type: "recordSaved" },
      );

      expect(next.pendingSubmit).toBeNull();
      expect(next.captureResultApplied).toBe(false);
      // 自分デッキと対戦モードだけ引き継ぐ。
      expect(next.form).toEqual({
        ...EMPTY_BATTLE_FORM_STATE,
        ownDeckId: "own-1",
        battleMode: "rated",
      });
    });
  });

  describe("captureTurnOrderDetected / manualPatch", () => {
    it("captureTurnOrderDetected は turnOrder を設定する", () => {
      const next = battleFormReducer(makeState({}), {
        type: "captureTurnOrderDetected",
        order: "first",
      });
      expect(next.form.turnOrder).toBe("first");
    });

    it("manualPatch は部分更新する", () => {
      const next = battleFormReducer(makeState({ memo: "a" }), {
        type: "manualPatch",
        patch: { opponentDeckId: "opp-2", memo: "b" },
      });
      expect(next.form.opponentDeckId).toBe("opp-2");
      expect(next.form.memo).toBe("b");
    });
  });

  describe("capturePreviewResultDetected", () => {
    it("勝敗だけ反映し、保存対象は立てない", () => {
      const records: BattleRecord[] = [];
      const next = battleFormReducer(
        makeState({ ownDeckId: "own-1", turnOrder: "first" }),
        {
          type: "capturePreviewResultDetected",
          result: "win",
          records,
          skipAutoScore: false,
        },
      );
      expect(next.form.result).toBe("win");
      expect(next.captureResultApplied).toBe(true);
      expect(next.pendingSubmit).toBeNull();
    });
  });
});
