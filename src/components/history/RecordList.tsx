import { useParams, useNavigate } from "react-router-dom";
import type { BattleRecord } from "../../types";
import EmptyState from "../ui/EmptyState";
import RecordTable from "./RecordTable";
import RecordDetail from "./RecordDetail";

export interface RecordListProps {
  records: BattleRecord[];
}

export default function RecordList({ records }: RecordListProps) {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();

  const sorted = [...records].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const selectedRecord = recordId
    ? (records.find((r) => r.id === recordId) ?? null)
    : null;

  if (sorted.length === 0) {
    return (
      <EmptyState
        title="戦績がありません"
        description="条件に一致する戦績が見つかりませんでした。"
      />
    );
  }

  return (
    <>
      <RecordTable
        records={sorted}
        onDetailClick={(record) => navigate(`/record/history/${record.id}`)}
      />

      {selectedRecord !== null && (
        <RecordDetail
          record={selectedRecord}
          isOpen={true}
          onClose={() => navigate("/record/history")}
        />
      )}
    </>
  );
}
