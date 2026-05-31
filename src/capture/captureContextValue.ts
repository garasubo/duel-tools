import { createContext } from 'react';
import type { CaptureEventListener } from './captureEvents';
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
  captureCurrentFrameDataUrl: () => string | null;
  setWaitForRatingBeforeAutoConfirm: (wait: boolean) => void;
  start: () => Promise<void>;
  stop: () => void;
  subscribeCaptureEvents: (listener: CaptureEventListener) => () => void;
}

export const CaptureContext = createContext<CaptureContextValue | null>(null);
