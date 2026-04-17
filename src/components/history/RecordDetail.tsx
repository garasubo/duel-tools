import { useState } from "react";
import type { BattleRecord } from "../../types";
import { useBattlesContext } from "../../context/BattlesContext";
import { formatDate } from "../../utils/formatDate";
import { battleModeLabel, getScoreLabel } from "../../utils/battleMode";
import { turnOrderLabel } from "../../utils/turnOrder";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import TagChip from "../ui/TagChip";
import RecordDetailEdit from "./RecordDetailEdit";

export interface RecordDetailProps {
  record: BattleRecord;
  isOpen: boolean;
  onClose: () => void;
}

export default function RecordDetail({
  record,
  isOpen,
  onClose,
}: RecordDetailProps) {
  const {
    ownDecks,
    opponentDecks,
    knownTags,
    updateRecord,
    deleteRecord,
    addOwnDeck,
    addOpponentDeck,
    addKnownTag,
  } = useBattlesContext();

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const ownDeckName =
    ownDecks.find((d) => d.id === record.ownDeckId)?.name ?? record.ownDeckId;
  const opponentDeckName =
    record.opponentDeckId === ""
      ? "不明"
      : (opponentDecks.find((d) => d.id === record.opponentDeckId)?.name ??
        record.opponentDeckId);

  function handleEditSave(
    patch: Partial<Omit<BattleRecord, "id" | "createdAt">>,
  ) {
    updateRecord(record.id, patch);
    setEditing(false);
  }

  function handleDelete() {
    deleteRecord(record.id);
    onClose();
  }

  function handleClose() {
    setEditing(false);
    setConfirmDelete(false);
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={editing ? "戦績を編集" : "戦績詳細"}
      className="max-h-[90vh]"
    >
      {editing ? (
        <RecordDetailEdit
          record={record}
          ownDecks={ownDecks}
          opponentDecks={opponentDecks}
          knownTags={knownTags}
          onAddOwnDeck={addOwnDeck}
          onAddOpponentDeck={addOpponentDeck}
          onAddKnownTag={addKnownTag}
          onSave={handleEditSave}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Badge result={record.result} />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {ownDeckName} vs {opponentDeckName}
              </p>
              <p className="text-xs text-gray-500">
                {formatDate(record.createdAt)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">手番</p>
              <p className="font-medium text-gray-800">
                {turnOrderLabel[record.turnOrder]}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">自分のデッキ</p>
              <p className="font-medium text-gray-800">{ownDeckName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">相手のデッキ</p>
              <p className="font-medium text-gray-800">{opponentDeckName}</p>
            </div>
            {record.battleMode !== undefined && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">対戦モード</p>
                <p className="font-medium text-gray-800">
                  {battleModeLabel[record.battleMode]}
                </p>
              </div>
            )}
            {record.score !== undefined && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">
                  {getScoreLabel(record.battleMode ?? null)}
                </p>
                <p className="font-medium text-gray-800">
                  {record.score.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {record.reasonTags.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">勝敗理由タグ</p>
              <div className="flex flex-wrap gap-1">
                {record.reasonTags.map((tag) => (
                  <TagChip key={tag} label={tag} />
                ))}
              </div>
            </div>
          )}

          {record.memo && (
            <div>
              <p className="text-xs text-gray-500 mb-1">メモ</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {record.memo}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditing(true)}
            >
              編集
            </Button>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600">
                  本当に削除しますか？
                </span>
                <Button variant="danger" size="sm" onClick={handleDelete}>
                  削除する
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  キャンセル
                </Button>
              </div>
            ) : (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmDelete(true)}
              >
                削除
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
