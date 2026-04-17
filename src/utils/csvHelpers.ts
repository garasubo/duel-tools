import type { BattleRecord, Deck } from "../types";
import { formatDate } from "./formatDate";
import { battleModeLabel } from "./battleMode";
import { turnOrderLabel } from "./turnOrder";

const RESULT_LABELS: Record<string, string> = {
  win: "○",
  loss: "×",
};

function escape(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

export function buildCsvString(
  records: BattleRecord[],
  ownDecks: Deck[],
  opponentDecks: Deck[],
): string {
  const ownDeckMap = new Map(ownDecks.map((d) => [d.id, d.name]));
  const opponentDeckMap = new Map(opponentDecks.map((d) => [d.id, d.name]));

  const headers = [
    "日時",
    "自分のデッキ",
    "相手のデッキ",
    "手番",
    "結果",
    "モード",
    "スコア",
    "タグ",
    "メモ",
  ];
  const rows = records.map((r) => [
    formatDate(r.createdAt),
    ownDeckMap.get(r.ownDeckId) ?? r.ownDeckId,
    r.opponentDeckId === ""
      ? "不明"
      : (opponentDeckMap.get(r.opponentDeckId) ?? r.opponentDeckId),
    turnOrderLabel[r.turnOrder] ?? r.turnOrder,
    RESULT_LABELS[r.result] ?? r.result,
    r.battleMode !== undefined ? (battleModeLabel[r.battleMode] ?? r.battleMode) : "",
    r.score !== undefined ? String(r.score) : "",
    r.reasonTags.join(" "),
    r.memo,
  ]);

  const lines = [headers, ...rows].map((row) => row.map(escape).join(","));
  // UTF-8 BOM（Excelで開いた際の日本語文字化け防止）
  return "\uFEFF" + lines.join("\r\n");
}
