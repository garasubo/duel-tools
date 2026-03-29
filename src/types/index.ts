export type BattleResult = 'win' | 'loss';
export type TurnOrder = 'first' | 'second' | 'third';

export interface Deck {
  id: string;
  name: string;
}

export interface BattleRecord {
  id: string;
  createdAt: string;
  ownDeckId: string;
  opponentDeckId: string;
  result: BattleResult;
  turnOrder: TurnOrder;
  reasonTags: string[];
  memo: string;
}

export interface AppStorage {
  records: BattleRecord[];
  ownDecks: Deck[];
  opponentDecks: Deck[];
  knownTags: string[];
}
