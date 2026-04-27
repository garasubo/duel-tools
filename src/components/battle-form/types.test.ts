import { describe, expect, it } from 'vitest';
import type { BattleFormState } from './types';
import {
  applySuggestedResultToBattleForm,
  createInitialBattleFormState,
  createNextBattleFormState,
  EMPTY_BATTLE_FORM_STATE,
  isBattleFormValid,
} from './types';
import type { BattleRecord } from '../../types';

const filledForm: BattleFormState = {
  ownDeckId: 'own-1',
  opponentDeckId: 'opponent-1',
  result: 'win',
  turnOrder: 'first',
  reasonTags: ['ミス'],
  memo: 'memo',
  battleMode: 'duelists-cup',
  score: '51000',
};

const latestRecord: BattleRecord = {
  id: 'record-1',
  createdAt: '2026-04-01T00:00:00.000Z',
  ownDeckId: 'own-1',
  opponentDeckId: 'opponent-1',
  result: 'loss',
  turnOrder: 'second',
  reasonTags: ['事故'],
  memo: 'latest',
  battleMode: 'rated',
  score: 1500,
};

describe('battle-form state helpers', () => {
  it('直近レコードがない場合は空のフォームを作る', () => {
    expect(createInitialBattleFormState(null)).toEqual(EMPTY_BATTLE_FORM_STATE);
  });

  it('直近レコードから自分デッキと対戦モードだけを引き継ぐ', () => {
    expect(createInitialBattleFormState(latestRecord)).toEqual({
      ...EMPTY_BATTLE_FORM_STATE,
      ownDeckId: 'own-1',
      battleMode: 'rated',
    });
  });

  it('保存後は自分デッキと対戦モードだけを残す', () => {
    const next = createNextBattleFormState(filledForm);

    expect(next).toEqual({
      ...EMPTY_BATTLE_FORM_STATE,
      ownDeckId: 'own-1',
      battleMode: 'duelists-cup',
    });
    expect(isBattleFormValid(next)).toBe(false);
  });

  it('未入力が残っていてもキャプチャ判定の勝敗だけを反映できる', () => {
    const next = applySuggestedResultToBattleForm(
      {
        ...EMPTY_BATTLE_FORM_STATE,
        ownDeckId: 'own-1',
      },
      'win',
      [],
    );

    expect(next.result).toBe('win');
    expect(next.turnOrder).toBeNull();
    expect(isBattleFormValid(next)).toBe(false);
  });
});
