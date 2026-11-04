import { describe, expect, it } from 'vitest';
import { matchesFilter, type FilterState } from './useFilter';
import type { BattleRecord, TurnOrder } from '../types';

const EMPTY: FilterState = {
  ownDeckId: '',
  opponentDeckId: '',
  result: '',
  turnOrder: '',
  coinToss: '',
  dateFrom: '',
  dateTo: '',
};

function record(turnOrder: TurnOrder): BattleRecord {
  return {
    id: turnOrder,
    createdAt: '2026-04-01T00:00:00.000Z',
    ownDeckId: 'own',
    opponentDeckId: 'opp',
    result: 'win',
    turnOrder,
    reasonTags: [],
    memo: '',
  };
}

const all = [record('first'), record('second'), record('third')];
const ids = (filter: FilterState) =>
  all.filter((r) => matchesFilter(r, filter)).map((r) => r.turnOrder);

describe('matchesFilter', () => {
  it('条件なしなら全件', () => {
    expect(ids(EMPTY)).toEqual(['first', 'second', 'third']);
  });

  it('コイン表は先攻のみ、コイン裏は後攻とゆずられ先攻', () => {
    expect(ids({ ...EMPTY, coinToss: 'heads' })).toEqual(['first']);
    expect(ids({ ...EMPTY, coinToss: 'tails' })).toEqual(['second', 'third']);
  });

  it('手番フィルタとは AND で組み合わさる', () => {
    expect(ids({ ...EMPTY, coinToss: 'tails', turnOrder: 'third' })).toEqual(['third']);
    expect(ids({ ...EMPTY, coinToss: 'heads', turnOrder: 'third' })).toEqual([]);
  });
});
