import { describe, it, expect } from "vitest";
import {
  buildMatchupSheet,
  buildOpponentDeckSheet,
  buildOwnDeckSheet,
  buildRecordsSheet,
  buildSummarySheet,
  buildWorkbookSheets,
} from "./xlsxSheetData";
import type { BattleRecord, Deck } from "../types";

const ownDecks: Deck[] = [
  { id: "own-1", name: "青眼の白龍" },
  { id: "own-2", name: "未使用デッキ" },
];
const opponentDecks: Deck[] = [{ id: "opp-1", name: "ブラック・マジシャン" }];

const record: BattleRecord = {
  id: "rec-1",
  createdAt: "2026-03-28T10:00:00.000Z",
  ownDeckId: "own-1",
  opponentDeckId: "opp-1",
  result: "win",
  turnOrder: "first",
  reasonTags: ["有利展開", "ミスなし"],
  memo: "メモ内容",
};

function makeRecord(overrides: Partial<BattleRecord>): BattleRecord {
  return { ...record, id: crypto.randomUUID(), ...overrides };
}

const options = {
  rangeLabel: "全記録（1件）",
  exportedAt: new Date("2026-03-28T10:00:00.000Z"),
};

describe("buildRecordsSheet", () => {
  it("CSVエクスポートと同じ9列のヘッダーを持つ", () => {
    const sheet = buildRecordsSheet([], ownDecks, opponentDecks);
    expect(sheet.name).toBe("戦績");
    expect(sheet.columns.map((c) => c.header)).toEqual([
      "日時",
      "自分のデッキ",
      "相手のデッキ",
      "手番",
      "結果",
      "モード",
      "スコア",
      "タグ",
      "メモ",
    ]);
    expect(sheet.rows).toEqual([]);
  });

  it("デッキ名・結果・手番が日本語に変換される", () => {
    const [row] = buildRecordsSheet([record], ownDecks, opponentDecks).rows;
    expect(row[1]).toBe("青眼の白龍");
    expect(row[2]).toBe("ブラック・マジシャン");
    expect(row[3]).toBe("先攻");
    expect(row[4]).toBe("○");
  });

  it("日時はタイムゾーンを持たないローカル日時文字列になる", () => {
    const [row] = buildRecordsSheet([record], ownDecks, opponentDecks).rows;
    // Excel にはタイムゾーンの概念が無いため、末尾に Z やオフセットが付いてはいけない。
    expect(row[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it("日時はアプリの表示と同じローカル時刻を指す", () => {
    const [row] = buildRecordsSheet([record], ownDecks, opponentDecks).rows;
    // オフセットの無い日時文字列はローカル時刻として解釈されるので、
    // 元の瞬間と一致すれば「見たままの時刻」が保たれている。
    // （UTC基準で書き出してしまう実装だとJSTで9時間ずれる）
    expect(new Date(String(row[0])).getTime()).toBe(new Date(record.createdAt).getTime());
  });

  it("相手デッキが未設定のときは「不明」になる", () => {
    const [row] = buildRecordsSheet(
      [makeRecord({ opponentDeckId: "" })],
      ownDecks,
      opponentDecks,
    ).rows;
    expect(row[2]).toBe("不明");
  });

  it("デッキIDが見つからない場合はIDをそのまま出力する", () => {
    const [row] = buildRecordsSheet(
      [makeRecord({ ownDeckId: "unknown-id" })],
      ownDecks,
      opponentDecks,
    ).rows;
    expect(row[1]).toBe("unknown-id");
  });

  it("タグはスペース区切りで結合される", () => {
    const [row] = buildRecordsSheet([record], ownDecks, opponentDecks).rows;
    expect(row[7]).toBe("有利展開 ミスなし");
  });

  it("スコアは数値セル、未設定なら空セルになる", () => {
    const withScore = makeRecord({ score: 50000, battleMode: "duelists-cup" });
    const [scored] = buildRecordsSheet([withScore], ownDecks, opponentDecks).rows;
    expect(scored[6]).toBe(50000);
    expect(typeof scored[6]).toBe("number");
    expect(scored[5]).toBe("デュエリストカップ");

    const [unscored] = buildRecordsSheet([record], ownDecks, opponentDecks).rows;
    expect(unscored[6]).toBeUndefined();
    expect(unscored[5]).toBeUndefined();
  });
});

describe("buildSummarySheet", () => {
  const records = [
    makeRecord({ result: "win", turnOrder: "first" }),
    makeRecord({ result: "loss", turnOrder: "second" }),
    makeRecord({ result: "win", turnOrder: "third" }),
  ];

  it("説明行に出力範囲と出力日時が記録される", () => {
    const sheet = buildSummarySheet(records, options);
    expect(sheet.notes?.some((n) => n.includes("全記録（1件）"))).toBe(true);
    expect(sheet.notes?.some((n) => n.includes("ゆずられ先攻を先攻に含める: いいえ"))).toBe(
      true,
    );
  });

  it("総合・先攻・後攻・コイントスの4行を返す", () => {
    const sheet = buildSummarySheet(records, options);
    expect(sheet.rows.map((r) => r[0])).toEqual([
      "総合",
      "先攻",
      "後攻",
      "コイントス（先攻率）",
    ]);
  });

  it("勝率は0〜1の数値で書かれる", () => {
    const [overall] = buildSummarySheet(records, options).rows;
    // 3戦2勝
    expect(overall[1]).toBe(3);
    expect(overall[2]).toBe(2);
    expect(overall[3]).toBe(1);
    expect(overall[4]).toBeCloseTo(2 / 3);
  });

  it("includeGrantedFirstで先攻の試合数が変わる", () => {
    const without = buildSummarySheet(records, options).rows[1];
    const with_ = buildSummarySheet(records, {
      ...options,
      includeGrantedFirst: true,
    }).rows[1];
    expect(without[1]).toBe(1);
    expect(with_[1]).toBe(2);
  });

  it("0件のとき勝率は0になる", () => {
    const [overall] = buildSummarySheet([], options).rows;
    expect(overall[1]).toBe(0);
    expect(overall[4]).toBe(0);
  });
});

describe("buildOwnDeckSheet / buildOpponentDeckSheet", () => {
  const records = [
    makeRecord({ result: "win", turnOrder: "first" }),
    makeRecord({ result: "loss", turnOrder: "second" }),
    makeRecord({ result: "win", turnOrder: "first", opponentDeckId: "" }),
  ];

  it("勝率列はpercent、試合数列はnumberとして定義される", () => {
    const sheet = buildOwnDeckSheet(records, ownDecks);
    const byHeader = new Map(sheet.columns.map((c) => [c.header, c.format]));
    expect(byHeader.get("勝率")).toBe("percent");
    expect(byHeader.get("試合数")).toBe("number");
    expect(byHeader.get("自分のデッキ")).toBe("text");
  });

  it("自分デッキはownDecksの順で、0件のデッキも含まれる", () => {
    const sheet = buildOwnDeckSheet(records, ownDecks);
    expect(sheet.rows.map((r) => r[0])).toEqual(["青眼の白龍", "未使用デッキ"]);
    expect(sheet.rows[1][1]).toBe(0);
  });

  it("相手デッキは試合数降順で「不明」が最下部に来る", () => {
    const sheet = buildOpponentDeckSheet(records, opponentDecks);
    expect(sheet.rows.map((r) => r[0])).toEqual(["ブラック・マジシャン", "不明"]);
  });
});

describe("buildMatchupSheet", () => {
  it("対戦実績のある組み合わせだけを縦持ちで返す", () => {
    const records = [
      makeRecord({ result: "win", turnOrder: "first" }),
      makeRecord({ result: "loss", turnOrder: "second" }),
    ];
    const sheet = buildMatchupSheet(records, ownDecks, opponentDecks);
    // own-2 は対戦実績が無いので現れない
    expect(sheet.rows).toEqual([
      ["青眼の白龍", "ブラック・マジシャン", 2, 1, 1, 0.5],
    ]);
  });

  it("相手デッキが未登録の記録は含まれない", () => {
    const sheet = buildMatchupSheet(
      [makeRecord({ opponentDeckId: "" })],
      ownDecks,
      opponentDecks,
    );
    expect(sheet.rows).toEqual([]);
  });
});

describe("buildWorkbookSheets", () => {
  it("5シートを決まった順で返す", () => {
    const sheets = buildWorkbookSheets([record], ownDecks, opponentDecks, options);
    expect(sheets.map((s) => s.name)).toEqual([
      "戦績",
      "統計サマリー",
      "デッキ別勝率",
      "相手デッキ別勝率",
      "マッチアップ",
    ]);
  });

  it("シート名がExcelの制約を満たす", () => {
    const sheets = buildWorkbookSheets([record], ownDecks, opponentDecks, options);
    const names = sheets.map((s) => s.name);
    for (const name of names) {
      expect(name.length).toBeLessThanOrEqual(31);
      expect(name).not.toMatch(/[[\]:*?/\\]/);
    }
    expect(new Set(names).size).toBe(names.length);
  });

  it("各シートで列数と行の長さが一致する", () => {
    const sheets = buildWorkbookSheets([record], ownDecks, opponentDecks, options);
    for (const sheet of sheets) {
      for (const row of sheet.rows) {
        expect(row).toHaveLength(sheet.columns.length);
      }
    }
  });
});
