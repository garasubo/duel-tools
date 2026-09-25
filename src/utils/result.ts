import type { BattleResult } from "../types";

export const resultLabel: Record<BattleResult, string> = {
  win: "○",
  loss: "×",
};

export const resultFromLabel: Record<string, BattleResult> = {
  "○": "win",
  "×": "loss",
};
