import { describe, expect, it } from 'vitest';
import { getNextTurnOrderSelection } from './turnOrderSelection';

describe('getNextTurnOrderSelection', () => {
  it('選択済みの手番を再選択すると解除する', () => {
    expect(getNextTurnOrderSelection('first', 'first')).toBeNull();
  });

  it('別の手番を選択するとその値に切り替える', () => {
    expect(getNextTurnOrderSelection('first', 'second')).toBe('second');
  });

  it('未選択のときは選択した手番を返す', () => {
    expect(getNextTurnOrderSelection(null, 'third')).toBe('third');
  });
});
