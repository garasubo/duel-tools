import type { BattleRecord, Deck } from "../types";
import {
  calcWLD,
  computeCoinToss,
  computeDeckStats,
  computeMatchupCells,
  computeOpponentDeckStats,
  type WinLoss,
} from "../hooks/useStats";
import { battleModeLabel } from "./battleMode";
import { formatDate, toNaiveLocalISOString } from "./formatDate";
import { resultLabel } from "./result";
import { turnOrderLabel } from "./turnOrder";

// セルの値。空セルは undefined で表す。
// 'date' 列の値はタイムゾーンを持たないローカル日時文字列（toNaiveLocalISOString の出力）で、
// 書き込み側が Excel の日付シリアル値へ変換する。
export type CellValue = string | number | undefined;

export type ColumnFormat = "text" | "number" | "percent" | "date";

export interface SheetColumn {
  header: string;
  /** Excel の文字幅。日本語は全角なので autofit ではなく実測値を指定する。 */
  width: number;
  format: ColumnFormat;
}

export interface SheetData {
  /** Excel のシート名（31文字以内、[]:*?/\ を含まないこと）。 */
  name: string;
  /** ヘッダー行の上に出す説明行。 */
  notes?: string[];
  columns: SheetColumn[];
  rows: CellValue[][];
}

export interface XlsxExportOptions {
  /** 出力対象の説明（例: 「絞り込み結果（128件）」）。統計サマリーに記録する。 */
  rangeLabel: string;
  includeGrantedFirst?: boolean;
  /** 出力日時。テストで固定できるようにする。 */
  exportedAt?: Date;
}

const UNKNOWN_DECK = "不明";

function deckNameResolver(decks: Deck[]): (id: string) => string {
  const map = new Map(decks.map((d) => [d.id, d.name]));
  // 未登録のIDはCSVエクスポートと同じくIDをそのまま出す（データを失わせないため）。
  return (id) => (id === "" ? UNKNOWN_DECK : (map.get(id) ?? id));
}

// 勝率は常に 0〜1 の数値で書き、表示上の % 化は書式に任せる。
// 0件のときは 0 とし、列全体を数値で揃える（試合数列を見れば空だと分かる）。
function winLossCells(stats: WinLoss): CellValue[] {
  return [stats.total, stats.win, stats.loss, stats.winRate];
}

const WIN_LOSS_COLUMNS: SheetColumn[] = [
  { header: "試合数", width: 8, format: "number" },
  { header: "勝", width: 6, format: "number" },
  { header: "敗", width: 6, format: "number" },
  { header: "勝率", width: 9, format: "percent" },
];

export function buildRecordsSheet(
  records: BattleRecord[],
  ownDecks: Deck[],
  opponentDecks: Deck[],
): SheetData {
  const ownDeckName = deckNameResolver(ownDecks);
  const opponentDeckName = deckNameResolver(opponentDecks);

  return {
    name: "戦績",
    columns: [
      { header: "日時", width: 18, format: "date" },
      { header: "自分のデッキ", width: 22, format: "text" },
      { header: "相手のデッキ", width: 22, format: "text" },
      { header: "手番", width: 14, format: "text" },
      { header: "結果", width: 7, format: "text" },
      { header: "モード", width: 20, format: "text" },
      { header: "スコア", width: 10, format: "number" },
      { header: "タグ", width: 28, format: "text" },
      { header: "メモ", width: 40, format: "text" },
    ],
    rows: records.map((r) => [
      toNaiveLocalISOString(r.createdAt),
      ownDeckName(r.ownDeckId),
      opponentDeckName(r.opponentDeckId),
      turnOrderLabel[r.turnOrder] ?? r.turnOrder,
      resultLabel[r.result] ?? r.result,
      r.battleMode !== undefined
        ? (battleModeLabel[r.battleMode] ?? r.battleMode)
        : undefined,
      r.score,
      r.reasonTags.join(" "),
      r.memo,
    ]),
  };
}

export function buildSummarySheet(
  records: BattleRecord[],
  options: XlsxExportOptions,
): SheetData {
  const includeGrantedFirst = options.includeGrantedFirst ?? false;
  const exportedAt = options.exportedAt ?? new Date();

  const asFirst = records.filter(
    (r) => r.turnOrder === "first" || (includeGrantedFirst && r.turnOrder === "third"),
  );
  const asSecond = records.filter((r) => r.turnOrder === "second");

  return {
    name: "統計サマリー",
    notes: [
      "duel-tools 戦績エクスポート",
      `出力日時: ${formatDate(exportedAt.toISOString())}`,
      `対象範囲: ${options.rangeLabel}`,
      `ゆずられ先攻を先攻に含める: ${includeGrantedFirst ? "はい" : "いいえ"}`,
    ],
    columns: [{ header: "区分", width: 22, format: "text" }, ...WIN_LOSS_COLUMNS],
    rows: [
      ["総合", ...winLossCells(calcWLD(records))],
      ["先攻", ...winLossCells(calcWLD(asFirst))],
      ["後攻", ...winLossCells(calcWLD(asSecond))],
      ["コイントス（先攻率）", ...winLossCells(computeCoinToss(records))],
    ],
  };
}

const DECK_STAT_COLUMNS: SheetColumn[] = [
  ...WIN_LOSS_COLUMNS,
  { header: "先攻試合数", width: 11, format: "number" },
  { header: "先攻勝率", width: 10, format: "percent" },
  { header: "後攻試合数", width: 11, format: "number" },
  { header: "後攻勝率", width: 10, format: "percent" },
];

export function buildOwnDeckSheet(
  records: BattleRecord[],
  ownDecks: Deck[],
  includeGrantedFirst = false,
): SheetData {
  return {
    name: "デッキ別勝率",
    columns: [{ header: "自分のデッキ", width: 24, format: "text" }, ...DECK_STAT_COLUMNS],
    rows: computeDeckStats(records, ownDecks, includeGrantedFirst).map((s) => [
      s.deckName,
      ...winLossCells(s.overall),
      s.asFirst.total,
      s.asFirst.winRate,
      s.asSecond.total,
      s.asSecond.winRate,
    ]),
  };
}

export function buildOpponentDeckSheet(
  records: BattleRecord[],
  opponentDecks: Deck[],
  includeGrantedFirst = false,
): SheetData {
  return {
    name: "相手デッキ別勝率",
    columns: [{ header: "相手のデッキ", width: 24, format: "text" }, ...DECK_STAT_COLUMNS],
    // 並び順（試合数降順・「不明」最下部）は computeOpponentDeckStats の結果をそのまま使う。
    rows: computeOpponentDeckStats(records, opponentDecks, includeGrantedFirst).map((s) => [
      s.deckName,
      ...winLossCells(s.overall),
      s.asFirst.total,
      s.asFirst.winRate,
      s.asSecond.total,
      s.asSecond.winRate,
    ]),
  };
}

// クロス集計表ではなく縦持ちにする。列数が固定になりオートフィルタが効く上、
// Excel 側でピボットテーブルにかけられる。
export function buildMatchupSheet(
  records: BattleRecord[],
  ownDecks: Deck[],
  opponentDecks: Deck[],
): SheetData {
  const ownDeckName = deckNameResolver(ownDecks);
  const opponentDeckName = deckNameResolver(opponentDecks);

  return {
    name: "マッチアップ",
    columns: [
      { header: "自分のデッキ", width: 24, format: "text" },
      { header: "相手のデッキ", width: 24, format: "text" },
      ...WIN_LOSS_COLUMNS,
    ],
    rows: computeMatchupCells(records, ownDecks, opponentDecks).map((cell) => [
      ownDeckName(cell.ownDeckId),
      opponentDeckName(cell.opponentDeckId),
      ...winLossCells(cell.stats),
    ]),
  };
}

export function buildWorkbookSheets(
  records: BattleRecord[],
  ownDecks: Deck[],
  opponentDecks: Deck[],
  options: XlsxExportOptions,
): SheetData[] {
  const includeGrantedFirst = options.includeGrantedFirst ?? false;
  return [
    buildRecordsSheet(records, ownDecks, opponentDecks),
    buildSummarySheet(records, options),
    buildOwnDeckSheet(records, ownDecks, includeGrantedFirst),
    buildOpponentDeckSheet(records, opponentDecks, includeGrantedFirst),
    buildMatchupSheet(records, ownDecks, opponentDecks),
  ];
}
