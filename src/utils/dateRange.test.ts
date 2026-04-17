import { describe, it, expect } from "vitest";
import { isWithinDateRange } from "./dateRange";

describe("isWithinDateRange", () => {
  it("空の範囲は常にtrue", () => {
    expect(isWithinDateRange("2025-01-01T10:00:00Z", "", "")).toBe(true);
  });

  it("dateFromのみ指定: ローカル日付の開始以降はtrue", () => {
    const from = "2025-03-10";
    const startLocal = new Date(`${from}T00:00:00`).toISOString();
    expect(isWithinDateRange(startLocal, from, "")).toBe(true);
  });

  it("dateFromのみ指定: ローカル日付の開始より前はfalse", () => {
    const from = "2025-03-10";
    const beforeLocal = new Date(
      new Date(`${from}T00:00:00`).getTime() - 1,
    ).toISOString();
    expect(isWithinDateRange(beforeLocal, from, "")).toBe(false);
  });

  it("dateToのみ指定: ローカル日付の終端23:59:59.999を含む", () => {
    const to = "2025-03-10";
    const endLocal = new Date(`${to}T23:59:59.999`).toISOString();
    expect(isWithinDateRange(endLocal, "", to)).toBe(true);
  });

  it("dateToのみ指定: 終端を超えるとfalse", () => {
    const to = "2025-03-10";
    const afterLocal = new Date(
      new Date(`${to}T23:59:59.999`).getTime() + 1,
    ).toISOString();
    expect(isWithinDateRange(afterLocal, "", to)).toBe(false);
  });

  it("同一日の開始と終了: その日の中なら含まれる", () => {
    const day = "2025-03-10";
    const noonLocal = new Date(`${day}T12:00:00`).toISOString();
    expect(isWithinDateRange(noonLocal, day, day)).toBe(true);
  });

  it("不正なcreatedAtはfalse", () => {
    expect(isWithinDateRange("not-a-date", "2025-01-01", "2025-12-31")).toBe(
      false,
    );
  });
});
