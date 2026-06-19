import { describe, expect, it } from 'vitest';
import type { BattleFormState } from './types';
import {
  applySuggestedResultToBattleForm,
  applyScoreSuggestionToBattleForm,
  createInitialBattleFormState,
  createNextBattleFormState,
  EMPTY_BATTLE_FORM_STATE,
  isBattleFormValid,
  shouldAutoSubmitSuggestedResult,
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

  it('キャプチャ結果を含む保存後も次の試合用フォームに戻す', () => {
    const next = createNextBattleFormState({
      ...filledForm,
      result: 'loss',
      turnOrder: 'second',
    });

    expect(next).toEqual({
      ...EMPTY_BATTLE_FORM_STATE,
      ownDeckId: 'own-1',
      battleMode: 'duelists-cup',
    });
  });
});

describe('applySuggestedResultToBattleForm（DC の ±1000 見積り）', () => {
  const prevDcRecord: BattleRecord = {
    ...latestRecord,
    id: 'dc-prev',
    battleMode: 'duelists-cup',
    score: 50000,
  };

  it('DC・スコア未入力なら直前DP±1000の見積りを入れる', () => {
    const state: BattleFormState = { ...EMPTY_BATTLE_FORM_STATE, battleMode: 'duelists-cup' };
    expect(applySuggestedResultToBattleForm(state, 'win', [prevDcRecord]).score).toBe('51000');
  });

  it('skipAutoScore のときは見積りを入れない（画面DP検出に任せる）', () => {
    const state: BattleFormState = { ...EMPTY_BATTLE_FORM_STATE, battleMode: 'duelists-cup' };
    const next = applySuggestedResultToBattleForm(state, 'win', [prevDcRecord], {
      skipAutoScore: true,
    });
    expect(next.result).toBe('win');
    expect(next.score).toBe('');
  });
});

describe('applyScoreSuggestionToBattleForm', () => {
  it('rated モード・スコア未入力のとき適用する', () => {
    const state: BattleFormState = { ...EMPTY_BATTLE_FORM_STATE, battleMode: 'rated' };
    expect(applyScoreSuggestionToBattleForm(state, 1501.43).score).toBe('1501.43');
  });

  it('duelists-cup モード・スコア未入力のとき適用する（DP）', () => {
    const state: BattleFormState = { ...EMPTY_BATTLE_FORM_STATE, battleMode: 'duelists-cup' };
    expect(applyScoreSuggestionToBattleForm(state, 1859).score).toBe('1859');
  });

  it('battleMode が null のときは適用しない', () => {
    const state: BattleFormState = { ...EMPTY_BATTLE_FORM_STATE };
    expect(applyScoreSuggestionToBattleForm(state, 1500).score).toBe('');
  });

  it('スコアが既に入力済みのときは上書きしない', () => {
    const state: BattleFormState = {
      ...EMPTY_BATTLE_FORM_STATE,
      battleMode: 'rated',
      score: '1450',
    };
    expect(applyScoreSuggestionToBattleForm(state, 1500).score).toBe('1450');
  });

  it('小数値が文字列として正しく保持される', () => {
    const state: BattleFormState = { ...EMPTY_BATTLE_FORM_STATE, battleMode: 'rated' };
    expect(applyScoreSuggestionToBattleForm(state, 1508.94).score).toBe('1508.94');
  });
});

describe('shouldAutoSubmitSuggestedResult', () => {
  it('レート戦では勝敗確定だけでは自動送信しない', () => {
    expect(
      shouldAutoSubmitSuggestedResult({
        ...EMPTY_BATTLE_FORM_STATE,
        battleMode: 'rated',
      }),
    ).toBe(false);
  });

  it('DCモードでも DP 検出を待つため自動送信しない', () => {
    expect(
      shouldAutoSubmitSuggestedResult({
        ...EMPTY_BATTLE_FORM_STATE,
        battleMode: 'duelists-cup',
      }),
    ).toBe(false);
  });

  it('対戦モード未選択では勝敗確定後に自動送信できる', () => {
    expect(shouldAutoSubmitSuggestedResult(EMPTY_BATTLE_FORM_STATE)).toBe(true);
  });
});
