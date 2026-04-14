import { describe, it, expect } from "vitest";
import { parseCsvImport } from "./csvImportHelpers";
import { buildCsvString } from "./csvHelpers";
import type { BattleRecord, Deck } from "../types";

const HEADERS = '"日時","自分のデッキ","相手のデッキ","手番","結果","モード","スコア","タグ","メモ"';

function makeCsv(...dataLines: string[]): string {
  return [HEADERS, ...dataLines].join("\r\n");
}

const NORMAL_LINE =
  '"2026/03/28 19:00","青眼の白龍","ブラック・マジシャン","先攻","○","","","有利展開 ミスなし","メモ内容"';

describe("parseCsvImport", () => {
  it("正常な行をパースできる", () => {
    const result = parseCsvImport(makeCsv(NORMAL_LINE));
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.ownDeckName).toBe("青眼の白龍");
    expect(row.opponentDeckName).toBe("ブラック・マジシャン");
    expect(row.turnOrder).toBe("first");
    expect(row.result).toBe("win");
    expect(row.battleMode).toBeUndefined();
    expect(row.score).toBeUndefined();
    expect(row.reasonTags).toEqual(["有利展開", "ミスなし"]);
    expect(row.memo).toBe("メモ内容");
  });

  it("BOMを除去できる", () => {
    const csv = "\uFEFF" + makeCsv(NORMAL_LINE);
    const result = parseCsvImport(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
  });

  it("「不明」の相手デッキは空文字になる", () => {
    const line =
      '"2026/03/28 19:00","青眼の白龍","不明","先攻","○","","","",""';
    const result = parseCsvImport(makeCsv(line));
    expect(result.rows[0].opponentDeckName).toBe("");
  });

  it("結果「×」はlossに変換される", () => {
    const line =
      '"2026/03/28 19:00","青眼の白龍","ブラック・マジシャン","後攻","×","","","",""';
    const result = parseCsvImport(makeCsv(line));
    expect(result.rows[0].result).toBe("loss");
    expect(result.rows[0].turnOrder).toBe("second");
  });

  it("「ゆずられ先攻」をthirdに変換できる", () => {
    const line =
      '"2026/03/28 19:00","青眼の白龍","ブラック・マジシャン","ゆずられ先攻","○","","","",""';
    const result = parseCsvImport(makeCsv(line));
    expect(result.rows[0].turnOrder).toBe("third");
  });

  it("モードとスコアをパースできる", () => {
    const line =
      '"2026/03/28 19:00","青眼の白龍","ブラック・マジシャン","先攻","○","デュエリストカップ","5000","",""';
    const result = parseCsvImport(makeCsv(line));
    expect(result.rows[0].battleMode).toBe("duelists-cup");
    expect(result.rows[0].score).toBe(5000);
  });

  it("モード「レート戦」をratedに変換できる", () => {
    const line =
      '"2026/03/28 19:00","青眼の白龍","ブラック・マジシャン","先攻","○","レート戦","1500","",""';
    const result = parseCsvImport(makeCsv(line));
    expect(result.rows[0].battleMode).toBe("rated");
  });

  it("クォートエスケープをアンエスケープできる", () => {
    const line =
      '"2026/03/28 19:00","青眼の白龍","ブラック・マジシャン","先攻","○","","","","彼は""勝った""と言った"';
    const result = parseCsvImport(makeCsv(line));
    expect(result.rows[0].memo).toBe('彼は"勝った"と言った');
  });

  it("空行をスキップする", () => {
    const csv = makeCsv(NORMAL_LINE, "", NORMAL_LINE);
    const result = parseCsvImport(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it("自分のデッキが空の行はエラー", () => {
    const line = '"2026/03/28 19:00","","ブラック・マジシャン","先攻","○","","","",""';
    const result = parseCsvImport(makeCsv(line));
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(2);
  });

  it("不正な結果値の行はエラー", () => {
    const line =
      '"2026/03/28 19:00","青眼の白龍","ブラック・マジシャン","先攻","引き分け","","","",""';
    const result = parseCsvImport(makeCsv(line));
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it("不正な手番値の行はエラー", () => {
    const line =
      '"2026/03/28 19:00","青眼の白龍","ブラック・マジシャン","不明","○","","","",""';
    const result = parseCsvImport(makeCsv(line));
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it("不正なスコア値の行はエラー", () => {
    const line =
      '"2026/03/28 19:00","青眼の白龍","ブラック・マジシャン","先攻","○","","abc","",""';
    const result = parseCsvImport(makeCsv(line));
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it("エラー行と正常行が混在しても正常行は取得できる", () => {
    const badLine = '"2026/03/28 19:00","","ブラック・マジシャン","先攻","○","","","",""';
    const csv = makeCsv(badLine, NORMAL_LINE);
    const result = parseCsvImport(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });

  it("buildCsvStringで出力したCSVを再インポートできる", () => {
    const ownDecks: Deck[] = [{ id: "own-1", name: "青眼の白龍" }];
    const opponentDecks: Deck[] = [{ id: "opp-1", name: "ブラック・マジシャン" }];
    const record: BattleRecord = {
      id: "rec-1",
      createdAt: "2026-03-28T10:00:00.000Z",
      ownDeckId: "own-1",
      opponentDeckId: "opp-1",
      result: "win",
      turnOrder: "first",
      battleMode: "duelists-cup",
      score: 5000,
      reasonTags: ["有利展開", "ミスなし"],
      memo: "メモ内容",
    };
    const csv = buildCsvString([record], ownDecks, opponentDecks);
    const result = parseCsvImport(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.ownDeckName).toBe("青眼の白龍");
    expect(row.opponentDeckName).toBe("ブラック・マジシャン");
    expect(row.result).toBe("win");
    expect(row.turnOrder).toBe("first");
    expect(row.battleMode).toBe("duelists-cup");
    expect(row.score).toBe(5000);
    expect(row.reasonTags).toEqual(["有利展開", "ミスなし"]);
    expect(row.memo).toBe("メモ内容");
  });
});
