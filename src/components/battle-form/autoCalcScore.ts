import type { BattleRecord, BattleResult } from "../../types";

export function autoCalcDuelistsCupScore(
  result: BattleResult,
  records: BattleRecord[],
): string | null {
  const lastRecord = records.find(
    (r) => r.battleMode === "duelists-cup" && r.score !== undefined,
  );
  if (lastRecord === undefined || lastRecord.score === undefined) return null;

  const delta = result === "win" ? 1000 : -1000;
  return String(lastRecord.score + delta);
}
