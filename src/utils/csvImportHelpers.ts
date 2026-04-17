import type { BattleMode, BattleResult, TurnOrder } from "../types";
import { battleModeFromLabel } from "./battleMode";
import { turnOrderFromLabel } from "./turnOrder";

export interface CsvImportRow {
  createdAt: string;
  ownDeckName: string;
  opponentDeckName: string;
  result: BattleResult;
  turnOrder: TurnOrder;
  battleMode?: BattleMode;
  score?: number;
  reasonTags: string[];
  memo: string;
}

export interface CsvImportError {
  row: number;
  message: string;
}

export interface CsvImportResult {
  rows: CsvImportRow[];
  errors: CsvImportError[];
}

const RESULT_MAP: Record<string, BattleResult> = {
  "○": "win",
  "×": "loss",
};

const TURN_ORDER_MAP: Record<string, TurnOrder> = turnOrderFromLabel;
const BATTLE_MODE_MAP: Record<string, BattleMode> = battleModeFromLabel;

/** RFC 4180 に準拠した1行分のフィールドをパースする */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      // quoted field
      let field = "";
      i++; // opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++; // closing quote
            break;
          }
        } else {
          field += line[i];
          i++;
        }
      }
      fields.push(field);
      if (line[i] === ",") i++;
    } else {
      // unquoted field
      const end = line.indexOf(",", i);
      if (end === -1) {
        fields.push(line.slice(i));
        break;
      } else {
        fields.push(line.slice(i, end));
        i = end + 1;
      }
    }
  }
  return fields;
}

function parseCreatedAt(dateStr: string): string | null {
  // formatDate() outputs "YYYY/MM/DD HH:mm" via ja-JP locale
  // new Date("YYYY/MM/DD HH:mm") treats it as local time
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function parseCsvImport(csvText: string): CsvImportResult {
  const rows: CsvImportRow[] = [];
  const errors: CsvImportError[] = [];

  // BOM 除去
  const text = csvText.startsWith("\uFEFF") ? csvText.slice(1) : csvText;

  // CRLF / LF 正規化後に行分割
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  if (lines.length === 0) return { rows, errors };

  const header = parseCsvLine(lines[0]);
  const idx = (name: string) => header.indexOf(name);

  const iDate = idx("日時");
  const iOwn = idx("自分のデッキ");
  const iOpp = idx("相手のデッキ");
  const iTurn = idx("手番");
  const iResult = idx("結果");
  const iMode = idx("モード");
  const iScore = idx("スコア");
  const iTags = idx("タグ");
  const iMemo = idx("メモ");

  for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx].trim();
    if (line === "") continue;

    const rowNum = lineIdx + 1; // 1-based, header is row 1
    const fields = parseCsvLine(line);
    const get = (i: number) => (i >= 0 ? (fields[i] ?? "").trim() : "");

    // 必須: 自分のデッキ
    const ownDeckName = get(iOwn);
    if (ownDeckName === "") {
      errors.push({ row: rowNum, message: "自分のデッキが空です" });
      continue;
    }

    // 必須: 結果
    const resultRaw = get(iResult);
    const result = RESULT_MAP[resultRaw];
    if (!result) {
      errors.push({
        row: rowNum,
        message: `結果の値が不正です: "${resultRaw}"`,
      });
      continue;
    }

    // 必須: 手番
    const turnRaw = get(iTurn);
    const turnOrder = TURN_ORDER_MAP[turnRaw];
    if (!turnOrder) {
      errors.push({
        row: rowNum,
        message: `手番の値が不正です: "${turnRaw}"`,
      });
      continue;
    }

    // 日時
    const dateRaw = get(iDate);
    const createdAt = dateRaw ? parseCreatedAt(dateRaw) : null;
    if (dateRaw && !createdAt) {
      errors.push({
        row: rowNum,
        message: `日時のパースに失敗しました: "${dateRaw}"`,
      });
      continue;
    }

    // 相手のデッキ（"不明" → 空文字）
    const oppRaw = get(iOpp);
    const opponentDeckName = oppRaw === "不明" ? "" : oppRaw;

    // モード（任意）
    const modeRaw = get(iMode);
    const battleMode: BattleMode | undefined =
      modeRaw !== "" ? BATTLE_MODE_MAP[modeRaw] : undefined;
    if (modeRaw !== "" && battleMode === undefined) {
      errors.push({
        row: rowNum,
        message: `モードの値が不正です: "${modeRaw}"`,
      });
      continue;
    }

    // スコア（任意）
    const scoreRaw = get(iScore);
    let score: number | undefined;
    if (scoreRaw !== "") {
      const n = Number(scoreRaw);
      if (isNaN(n)) {
        errors.push({
          row: rowNum,
          message: `スコアの値が不正です: "${scoreRaw}"`,
        });
        continue;
      }
      score = n;
    }

    // タグ（スペース区切り）
    const tagsRaw = get(iTags);
    const reasonTags = tagsRaw !== "" ? tagsRaw.split(" ").filter(Boolean) : [];

    rows.push({
      createdAt: createdAt ?? new Date().toISOString(),
      ownDeckName,
      opponentDeckName,
      result,
      turnOrder,
      battleMode,
      score,
      reasonTags,
      memo: get(iMemo),
    });
  }

  return { rows, errors };
}
