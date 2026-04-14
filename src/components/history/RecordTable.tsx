import type { BattleRecord } from "../../types";
import { formatDate } from "../../utils/formatDate";
import Badge from "../ui/Badge";
import TagChip from "../ui/TagChip";

const turnOrderLabel: Record<string, string> = {
  first: "先攻",
  second: "後攻",
  third: "ゆずられ先攻",
};

export interface RecordTableProps {
  records: BattleRecord[];
  ownDeckMap: Map<string, string>;
  opponentDeckMap: Map<string, string>;
  onRowClick: (record: BattleRecord) => void;
}

const CHUNK_SIZE = 10;

export default function RecordTable({
  records,
  ownDeckMap,
  opponentDeckMap,
  onRowClick,
}: RecordTableProps) {
  // Chunk from oldest so match numbers start at 1 for the oldest record.
  // records is sorted newest-first, so reverse before chunking.
  const oldest = [...records].reverse();
  const chunks: BattleRecord[][] = [];
  for (let i = 0; i < oldest.length; i += CHUNK_SIZE) {
    chunks.push(oldest.slice(i, i + CHUNK_SIZE));
  }

  // Build display order: newest chunk first, each chunk displayed newest-first.
  const displayChunks = [...chunks]
    .reverse()
    .map((chunk, reversedIndex) => {
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
          </tr>
        </thead>
        <tbody>
          {displayChunks.map(({ records: chunkRecords, wins, coin_wins, size }) => {
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
              return (
                <tr
                  key={record.id}
                  onClick={() => onRowClick(record)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onRowClick(record);
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${ownName} vs ${opponentName} の戦績詳細を開く`}
                  className={`${recordIndex === 0 ? "border-t-2 border-gray-300" : "border-t border-gray-100"} hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 cursor-pointer transition-colors duration-100`}
                >
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                    {formatDate(record.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge result={record.result} />
                  </td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                    {turnOrderLabel[record.turnOrder]}
                  </td>
                  <td className="px-3 py-2 max-w-[12rem] truncate text-gray-900">
                    {ownName}
                  </td>
                  <td className="px-3 py-2 max-w-[12rem] truncate text-gray-900">
                    {opponentName}
                  </td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                    {record.score !== undefined
                      ? record.score.toLocaleString()
                      : ""}
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
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}
