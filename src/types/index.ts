export type BattleResult = 'win' | 'loss';
export type TurnOrder = 'first' | 'second' | 'third';
export type BattleMode = 'duelists-cup' | 'rated';

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
  battleMode?: BattleMode;
  score?: number;
}

export interface AppStorage {
  records: BattleRecord[];
  ownDecks: Deck[];
  opponentDecks: Deck[];
  knownTags: string[];
}
