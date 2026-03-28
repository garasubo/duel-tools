import { useState } from 'react';
import type { BattleRecord, BattleResult, TurnOrder } from '../../types';
import { useBattlesContext } from '../../context/BattlesContext';
import { formatDate } from '../../utils/formatDate';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import TagChip from '../ui/TagChip';
import DeckSelect from '../battle-form/DeckSelect';
import ResultSelector from '../battle-form/ResultSelector';
import TurnOrderSelector from '../battle-form/TurnOrderSelector';
import TagInput from '../battle-form/TagInput';
import MemoInput from '../battle-form/MemoInput';

export interface RecordDetailProps {
  record: BattleRecord;
  isOpen: boolean;
  onClose: () => void;
}

const turnOrderLabel: Record<string, string> = {
  first: '先行',
  second: '後攻',
};

interface EditState {
  ownDeckId: string;
  opponentDeckId: string;
  result: BattleResult | null;
  turnOrder: TurnOrder | null;
  reasonTags: string[];
  memo: string;
}

export default function RecordDetail({ record, isOpen, onClose }: RecordDetailProps) {
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
  const [editState, setEditState] = useState<EditState>({
    ownDeckId: record.ownDeckId,
    opponentDeckId: record.opponentDeckId,
    result: record.result,
    turnOrder: record.turnOrder,
    reasonTags: record.reasonTags,
    memo: record.memo,
  });

  const ownDeckName =
    ownDecks.find((d) => d.id === record.ownDeckId)?.name ?? record.ownDeckId;
  const opponentDeckName =
    opponentDecks.find((d) => d.id === record.opponentDeckId)?.name ?? record.opponentDeckId;

  const isEditValid =
    editState.ownDeckId !== '' &&
    editState.opponentDeckId !== '' &&
    editState.result !== null &&
    editState.turnOrder !== null;

  function handleEditStart() {
    setEditState({
      ownDeckId: record.ownDeckId,
      opponentDeckId: record.opponentDeckId,
      result: record.result,
      turnOrder: record.turnOrder,
      reasonTags: record.reasonTags,
      memo: record.memo,
    });
    setEditing(true);
  }

  function handleEditSave() {
    if (!isEditValid) return;
    updateRecord(record.id, {
      ownDeckId: editState.ownDeckId,
      opponentDeckId: editState.opponentDeckId,
      result: editState.result!,
      turnOrder: editState.turnOrder!,
      reasonTags: editState.reasonTags,
      memo: editState.memo,
    });
    setEditing(false);
  }

  function handleEditCancel() {
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

  function handleAddOwnDeck(name: string) {
    const deck = addOwnDeck(name);
    setEditState((s) => ({ ...s, ownDeckId: deck.id }));
  }

  function handleAddOpponentDeck(name: string) {
    const deck = addOpponentDeck(name);
    setEditState((s) => ({ ...s, opponentDeckId: deck.id }));
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={editing ? '戦績を編集' : '戦績詳細'}
      className="max-h-[90vh]"
    >
      {editing ? (
        <div className="flex flex-col gap-4">
          <DeckSelect
            label="自分のデッキ"
            decks={ownDecks}
            value={editState.ownDeckId}
            onChange={(id) => setEditState((s) => ({ ...s, ownDeckId: id }))}
            onAddDeck={handleAddOwnDeck}
          />
          <DeckSelect
            label="相手のデッキ"
            decks={opponentDecks}
            value={editState.opponentDeckId}
            onChange={(id) => setEditState((s) => ({ ...s, opponentDeckId: id }))}
            onAddDeck={handleAddOpponentDeck}
          />
          <ResultSelector
            value={editState.result}
            onChange={(result) => setEditState((s) => ({ ...s, result }))}
          />
          <TurnOrderSelector
            value={editState.turnOrder}
            onChange={(turnOrder) => setEditState((s) => ({ ...s, turnOrder }))}
          />
          <TagInput
            tags={editState.reasonTags}
            knownTags={knownTags}
            onChange={(reasonTags) => setEditState((s) => ({ ...s, reasonTags }))}
            onAddKnownTag={addKnownTag}
          />
          <MemoInput
            value={editState.memo}
            onChange={(memo) => setEditState((s) => ({ ...s, memo }))}
          />
          <div className="flex gap-2 pt-1">
            <Button onClick={handleEditSave} disabled={!isEditValid}>
              保存
            </Button>
            <Button variant="secondary" onClick={handleEditCancel}>
              キャンセル
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Badge result={record.result} />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {ownDeckName} vs {opponentDeckName}
              </p>
              <p className="text-xs text-gray-500">{formatDate(record.createdAt)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">手番</p>
              <p className="font-medium text-gray-800">{turnOrderLabel[record.turnOrder]}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">自分のデッキ</p>
              <p className="font-medium text-gray-800">{ownDeckName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">相手のデッキ</p>
              <p className="font-medium text-gray-800">{opponentDeckName}</p>
            </div>
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
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{record.memo}</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <Button variant="secondary" size="sm" onClick={handleEditStart}>
              編集
            </Button>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600">本当に削除しますか？</span>
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
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                削除
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
