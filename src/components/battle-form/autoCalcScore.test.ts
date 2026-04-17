import { describe, it, expect } from "vitest";
import { autoCalcDuelistsCupScore } from "./autoCalcScore";
import type { BattleRecord } from "../../types";

function record(partial: Partial<BattleRecord>): BattleRecord {
  return {
    id: "x",
    createdAt: "2025-01-01T00:00:00Z",
    ownDeckId: "o",
    opponentDeckId: "p",
    result: "win",
    turnOrder: "first",
    reasonTags: [],
    memo: "",
    ...partial,
  };
}

describe("autoCalcDuelistsCupScore", () => {
  it("DC戦のスコア履歴がなければ null", () => {
    expect(autoCalcDuelistsCupScore("win", [])).toBe(null);
  });

  it("DCではない最新レコードしかない場合も null", () => {
    const records = [record({ battleMode: "rated", score: 1500 })];
    expect(autoCalcDuelistsCupScore("win", records)).toBe(null);
  });

  it("win で +1000", () => {
    const records = [record({ battleMode: "duelists-cup", score: 50000 })];
    expect(autoCalcDuelistsCupScore("win", records)).toBe("51000");
  });

  it("loss で -1000", () => {
    const records = [record({ battleMode: "duelists-cup", score: 50000 })];
    expect(autoCalcDuelistsCupScore("loss", records)).toBe("49000");
  });

  it("先頭のDC戦レコードのスコアを基準にする", () => {
    const records = [
      record({ id: "a", battleMode: "duelists-cup", score: 52000 }),
      record({ id: "b", battleMode: "duelists-cup", score: 30000 }),
    ];
    expect(autoCalcDuelistsCupScore("win", records)).toBe("53000");
  });

  it("先頭にDC以外、その後にDCがある場合はそのDCを利用", () => {
    const records = [
      record({ id: "a", battleMode: "rated", score: 1500 }),
      record({ id: "b", battleMode: "duelists-cup", score: 48000 }),
    ];
    expect(autoCalcDuelistsCupScore("loss", records)).toBe("47000");
  });
});
