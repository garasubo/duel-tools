import { useMemo, useState } from "react";
import type { BattleRecord, BattleResult, TurnOrder } from "../../types";
import { formatDate } from "../../utils/formatDate";
import { getScoreBounds } from "../../utils/battleMode";
import { useBattlesContext } from "../../context/BattlesContext";
import Badge from "../ui/Badge";
import TagChip from "../ui/TagChip";
import EditableSelectCell from "./cells/EditableSelectCell";
import EditableNumberCell from "./cells/EditableNumberCell";

const RESULT_OPTIONS: { value: BattleResult; label: string }[] = [
  { value: "win", label: "勝ち" },
  { value: "loss", label: "負け" },
];

const TURN_ORDER_OPTIONS: { value: TurnOrder; label: string }[] = [
  { value: "first", label: "先攻" },
  { value: "second", label: "後攻" },
  { value: "third", label: "ゆずられ先攻" },
];

export interface RecordTableProps {
  records: BattleRecord[];
  onDetailClick: (record: BattleRecord) => void;
}

type EditingCell = { recordId: string; field: string } | null;

const CHUNK_SIZE = 10;

export default function RecordTable({
  records,
  onDetailClick,
}: RecordTableProps) {
  const { ownDecks, opponentDecks, updateRecord } = useBattlesContext();
  const [editingCell, setEditingCell] = useState<EditingCell>(null);

  const ownDeckOptions = useMemo(
    () => ownDecks.map((d) => ({ value: d.id, label: d.name })),
    [ownDecks],
  );

  const opponentDeckOptions = useMemo(
    () => [
      { value: "", label: "不明" },
      ...opponentDecks.map((d) => ({ value: d.id, label: d.name })),
    ],
    [opponentDecks],
  );

  const ownDeckMap = useMemo(
    () => new Map(ownDecks.map((d) => [d.id, d.name])),
    [ownDecks],
  );

  const opponentDeckMap = useMemo(
    () => new Map(opponentDecks.map((d) => [d.id, d.name])),
    [opponentDecks],
  );

  function isEditing(recordId: string, field: string) {
    return editingCell?.recordId === recordId && editingCell?.field === field;
  }

  function activate(recordId: string, field: string) {
    setEditingCell({ recordId, field });
  }

  function cancel() {
    setEditingCell(null);
  }

  function save(
    record: BattleRecord,
    patch: Partial<Omit<BattleRecord, "id" | "createdAt">>,
  ) {
    updateRecord(record.id, patch);
    setEditingCell(null);
  }

  const oldest = [...records].reverse();
  const chunks: BattleRecord[][] = [];
  for (let i = 0; i < oldest.length; i += CHUNK_SIZE) {
    chunks.push(oldest.slice(i, i + CHUNK_SIZE));
  }

  const displayChunks = [...chunks].reverse().map((chunk, reversedIndex) => {
    const chunkIndex = chunks.length - 1 - reversedIndex;
    return {
      records: [...chunk].reverse(),
      start: chunkIndex * CHUNK_SIZE + 1,
      end: chunkIndex * CHUNK_SIZE + chunk.length,
      wins: chunk.filter((r) => r.result === "win").length,
      coin_wins: chunk.filter((r) => r.turnOrder === "first").length,
      size: chunk.length,
    };
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="sticky top-0 z-10 bg-white border-b border-gray-200">
          <tr>
            <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap w-36">
              日時
            </th>
            <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap w-12">
              結果
            </th>
            <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap w-14">
              手番
            </th>
            <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap min-w-32">
              自分のデッキ
            </th>
            <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap min-w-32">
              相手のデッキ
            </th>
            <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap w-20">
              スコア
            </th>
            <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap w-28 text-center">
              10戦ごと
            </th>
            <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap min-w-24">
              タグ
            </th>
            <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap min-w-0">
              メモ
            </th>
            <th className="px-3 py-2 w-8" />
          </tr>
        </thead>
        <tbody>
          {displayChunks.map(
            ({ records: chunkRecords, wins, coin_wins, size }) => {
              const losses = size - wins;
              const winRate = (wins / size) * 100;
              const coinRate = (coin_wins / size) * 100;

              return chunkRecords.map((record, recordIndex) => {
                const ownName =
                  ownDeckMap.get(record.ownDeckId) ?? record.ownDeckId;
                const opponentName =
                  record.opponentDeckId === ""
                    ? "不明"
                    : (opponentDeckMap.get(record.opponentDeckId) ??
                      record.opponentDeckId);
                const scoreBounds = record.battleMode
                  ? getScoreBounds(record.battleMode)
                  : undefined;

                return (
                  <tr
                    key={record.id}
                    className={`${recordIndex === 0 ? "border-t-2 border-gray-300" : "border-t border-gray-100"} hover:bg-gray-50 transition-colors duration-100`}
                  >
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {formatDate(record.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <EditableSelectCell
                        value={record.result}
                        options={RESULT_OPTIONS}
                        isEditing={isEditing(record.id, "result")}
                        onActivate={() => activate(record.id, "result")}
                        onSave={(v) =>
                          save(record, { result: v as BattleResult })
                        }
                        onCancel={cancel}
                        renderDisplay={() => <Badge result={record.result} />}
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                      <EditableSelectCell
                        value={record.turnOrder}
                        options={TURN_ORDER_OPTIONS}
                        isEditing={isEditing(record.id, "turnOrder")}
                        onActivate={() => activate(record.id, "turnOrder")}
                        onSave={(v) =>
                          save(record, { turnOrder: v as TurnOrder })
                        }
                        onCancel={cancel}
                      />
                    </td>
                    <td className="px-3 py-2 max-w-[12rem] text-gray-900">
                      <EditableSelectCell
                        value={record.ownDeckId}
                        options={ownDeckOptions}
                        isEditing={isEditing(record.id, "ownDeckId")}
                        onActivate={() => activate(record.id, "ownDeckId")}
                        onSave={(v) => save(record, { ownDeckId: v })}
                        onCancel={cancel}
                        renderDisplay={() => (
                          <span className="block truncate">{ownName}</span>
                        )}
                      />
                    </td>
                    <td className="px-3 py-2 max-w-[12rem] text-gray-900">
                      <EditableSelectCell
                        value={record.opponentDeckId}
                        options={opponentDeckOptions}
                        isEditing={isEditing(record.id, "opponentDeckId")}
                        onActivate={() => activate(record.id, "opponentDeckId")}
                        onSave={(v) => save(record, { opponentDeckId: v })}
                        onCancel={cancel}
                        renderDisplay={() => (
                          <span className="block truncate">{opponentName}</span>
                        )}
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                      <EditableNumberCell
                        value={record.score}
                        isEditing={isEditing(record.id, "score")}
                        onActivate={() => activate(record.id, "score")}
                        onSave={(v) => save(record, { score: v })}
                        onCancel={cancel}
                        min={scoreBounds?.min}
                        max={scoreBounds?.max}
                      />
                    </td>
                    {recordIndex === 0 && (
                      <td
                        rowSpan={size}
                        className="px-3 py-2 text-center text-xs text-gray-600 bg-gray-50 border-l border-gray-200 whitespace-nowrap align-middle"
                      >
                        <div>
                          {wins}勝 {losses}敗
                        </div>
                        <div>勝率 {winRate.toFixed(1)}%</div>
                        <div>コイン勝率 {coinRate.toFixed(1)}%</div>
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {record.reasonTags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {record.reasonTags.map((tag) => (
                            <TagChip key={tag} label={tag} />
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-xs truncate text-gray-500">
                      {record.memo}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onDetailClick(record)}
                        title="タグ・メモを編集"
                        className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        aria-label="詳細・タグ・メモを編集"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-4 h-4"
                          aria-hidden="true"
                        >
                          <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              });
            },
          )}
        </tbody>
      </table>
    </div>
  );
}
