export type BattleResult = 'win' | 'loss';
export type TurnOrder = 'first' | 'second' | 'third';
export type BattleMode = 'duelists-cup' | 'rated';
export type OverlayStatId =
  | 'overall'
  | 'asFirst'
  | 'asSecond'
  | 'coinToss'
  | 'matchCount';

export type PanelDateFilterType = 'none' | 'today' | 'last7days' | 'last30days' | 'since';

export interface PanelDateFilter {
  type: PanelDateFilterType;
  sinceDate?: string;
}

export interface Deck {
  id: string;
  name: string;
}

export interface DraftBattle {
  turnOrder: TurnOrder | null;
  result: BattleResult | null;
}

export interface BattleFormState {
  ownDeckId: string;
  opponentDeckId: string;
  result: BattleResult | null;
  turnOrder: TurnOrder | null;
  reasonTags: string[];
  memo: string;
  battleMode: BattleMode | null;
  score: string;
}

export interface CaptureMemoShot {
  id: string;
  dataUrl: string;
  createdAt: number;
}

export interface OverlayStatSetting {
  id: OverlayStatId;
  visible: boolean;
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
  overlayStats: OverlayStatSetting[];
  panelDateFilter: PanelDateFilter;
}
