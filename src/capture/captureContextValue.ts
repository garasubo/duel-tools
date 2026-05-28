import { createContext } from 'react';
import type { TurnOrder } from '../types';
import type {
  CoinTossDebugInfo,
  DetectionResult,
  DuelCaptureState,
  RatingDetectionEvent,
  TurnOrderDetectionEvent,
} from './types';

export interface CaptureContextValue {
  captureState: DuelCaptureState;
  pendingResult: DetectionResult | null;
  lastOcrResult: 'win' | 'loss' | null;
  consecutiveCount: number;
  requiredConsecutiveCount: number;
  isCapturing: boolean;
  error: string | null;
  autoConfirmEnabled: boolean;
  setAutoConfirmEnabled: (enabled: boolean) => void;
  isCaptureDebugEnabled: boolean;
  hasFirstCandidateFrame: boolean;
  hasCoinTossFrame: boolean;
  hasRatingFrame: boolean;
  coinTossDebug: CoinTossDebugInfo | null;
  turnOrderDetection: TurnOrderDetectionEvent | null;
  clearTurnOrderDetection: () => void;
  ratingDetection: RatingDetectionEvent | null;
  clearRatingDetection: () => void;
  restartTurnOrderDetection: () => void;
  prepareNextDuelDetection: () => void;
  downloadCurrentFrame: () => void;
  downloadFirstCandidateFrame: () => void;
  downloadCoinTossFrame: () => void;
  downloadRatingFrame: () => void;
  captureRatingOnce: () => Promise<number | null>;
  setWaitForRatingBeforeAutoConfirm: (wait: boolean) => void;
  start: () => Promise<void>;
  stop: () => void;
  confirm: () => void;
  dismiss: () => void;
  setResultCallback: (cb: (result: 'win' | 'loss') => void) => void;
  clearResultCallback: () => void;
  setResultPreviewCallback: (cb: (result: 'win' | 'loss') => void) => void;
  clearResultPreviewCallback: () => void;
  setTurnOrderCallback: (cb: (order: TurnOrder) => void) => void;
  clearTurnOrderCallback: () => void;
  setRatingCallback: (cb: (rating: number) => void) => void;
  clearRatingCallback: () => void;
  setRatingConfirmCallback: (cb: (rating: number) => void) => void;
  clearRatingConfirmCallback: () => void;
}

export const CaptureContext = createContext<CaptureContextValue | null>(null);
