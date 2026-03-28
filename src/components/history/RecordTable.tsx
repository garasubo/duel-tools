import type { BattleRecord } from '../../types';
import { formatDate } from '../../utils/formatDate';
import Badge from '../ui/Badge';
import TagChip from '../ui/TagChip';

const turnOrderLabel: Record<string, string> = {
  first: '先行',
  second: '後攻',
};

export interface RecordTableProps {
  records: BattleRecord[];
  ownDeckMap: Map<string, string>;
  opponentDeckMap: Map<string, string>;
  onRowClick: (record: BattleRecord) => void;
}

export default function RecordTable({
  records,
  ownDeckMap,
  opponentDeckMap,
  onRowClick,
}: RecordTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="sticky top-0 z-10 bg-white border-b border-gray-200">
          <tr>
            <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap w-36">日時</th>
            <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap w-12">結果</th>
            <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap w-14">手番</th>
            <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap min-w-32">自分のデッキ</th>
            <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap min-w-32">相手のデッキ</th>
            <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap min-w-24">タグ</th>
            <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap min-w-0">メモ</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const ownName = ownDeckMap.get(record.ownDeckId) ?? record.ownDeckId;
            const opponentName =
              opponentDeckMap.get(record.opponentDeckId) ?? record.opponentDeckId;
            return (
              <tr
                key={record.id}
                onClick={() => onRowClick(record)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onRowClick(record);
                }}
                tabIndex={0}
                role="button"
                aria-label={`${ownName} vs ${opponentName} の戦績詳細を開く`}
                className="border-t border-gray-100 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 cursor-pointer transition-colors duration-100"
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
                <td className="px-3 py-2 max-w-[12rem] truncate text-gray-900">{ownName}</td>
                <td className="px-3 py-2 max-w-[12rem] truncate text-gray-900">{opponentName}</td>
                <td className="px-3 py-2">
                  {record.reasonTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {record.reasonTags.map((tag) => (
                        <TagChip key={tag} label={tag} />
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 max-w-xs truncate text-gray-500">{record.memo}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
