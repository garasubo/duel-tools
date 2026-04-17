import type { BattleMode } from "../types";

export const BATTLE_MODE_OPTIONS: { value: BattleMode; label: string }[] = [
  { value: "duelists-cup", label: "デュエリストカップ" },
  { value: "rated", label: "レート戦" },
];

export const battleModeLabel: Record<BattleMode, string> = {
  "duelists-cup": "デュエリストカップ",
  rated: "レート戦",
};

export const battleModeFromLabel: Record<string, BattleMode> = {
  デュエリストカップ: "duelists-cup",
  レート戦: "rated",
};

export function getScoreLabel(mode: BattleMode | null): string {
  return mode === "duelists-cup" ? "DP" : "レート";
}

export function getScoreBounds(mode: BattleMode): { min: number; max: number } {
  return mode === "duelists-cup"
    ? { min: 0, max: 100000 }
    : { min: 1000, max: 2000 };
}

export function getScorePlaceholder(mode: BattleMode): string {
  return mode === "duelists-cup" ? "例: 50000" : "例: 1500";
}
