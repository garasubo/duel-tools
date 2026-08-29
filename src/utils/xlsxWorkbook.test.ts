import { describe, it, expect } from "vitest";
import { assembleWorkbook, type XlsxApi } from "./xlsxWorkbook";
import { buildWorkbookSheets } from "./xlsxSheetData";
import type { BattleRecord, Deck } from "../types";

// vitest は node 環境で動くため nodejs ビルドを明示的に読み込む
// （web ビルドは fetch ベースの初期化が必要で node では動かない）。
// nodejs ビルドは同期初期化なので init 呼び出しは不要。
const xlsx = (await import("wasm-xlsxwriter/nodejs")) as unknown as XlsxApi;

const ownDecks: Deck[] = [{ id: "own-1", name: "青眼の白龍" }];
const opponentDecks: Deck[] = [{ id: "opp-1", name: "ブラック・マジシャン" }];

const records: BattleRecord[] = [
  {
    id: "rec-1",
    createdAt: "2026-03-28T10:00:00.000Z",
    ownDeckId: "own-1",
    opponentDeckId: "opp-1",
    result: "win",
    turnOrder: "first",
    reasonTags: ["有利展開"],
    memo: 'ダブルクォート " を含むメモ',
    battleMode: "duelists-cup",
    score: 50000,
  },
  {
    id: "rec-2",
    createdAt: "2026-03-29T02:30:00.000Z",
    ownDeckId: "own-1",
    opponentDeckId: "",
    result: "loss",
    turnOrder: "third",
    reasonTags: [],
    memo: "",
  },
];

const options = {
  rangeLabel: "全記録（2件）",
  exportedAt: new Date("2026-03-29T12:00:00.000Z"),
};

describe("assembleWorkbook", () => {
  it("ZIP形式の .xlsx バッファを生成する", () => {
    const sheets = buildWorkbookSheets(records, ownDecks, opponentDecks, options);
    const buffer = assembleWorkbook(xlsx, sheets);

    // xlsx は ZIP なので "PK\x03\x04" で始まる
    expect(Array.from(buffer.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it("戦績が0件でも壊れずに出力できる", () => {
    const sheets = buildWorkbookSheets([], ownDecks, opponentDecks, {
      ...options,
      rangeLabel: "全記録（0件）",
    });
    const buffer = assembleWorkbook(xlsx, sheets);
    expect(Array.from(buffer.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("繰り返し呼び出しても失敗しない（Formatの使い回しとメモリ解放の確認）", () => {
    const sheets = buildWorkbookSheets(records, ownDecks, opponentDecks, options);
    const first = assembleWorkbook(xlsx, sheets);
    const second = assembleWorkbook(xlsx, sheets);
    expect(second.byteLength).toBeGreaterThan(1000);
    // 同じ入力なので概ね同じサイズになる（タイムスタンプ差で厳密一致はしない）
    expect(Math.abs(first.byteLength - second.byteLength)).toBeLessThan(200);
  });
});
