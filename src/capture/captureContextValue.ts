import { createContext } from 'react';
import type { TurnOrder } from '../types';
import type { CoinTossDebugInfo, DetectionResult, DuelCaptureState } from './types';

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
  coinTossDebug: CoinTossDebugInfo | null;
  downloadCurrentFrame: () => void;
  downloadFirstCandidateFrame: () => void;
  start: () => Promise<void>;
  stop: () => void;
  confirm: () => void;
  dismiss: () => void;
  setResultCallback: (cb: (result: 'win' | 'loss') => void) => void;
  clearResultCallback: () => void;
  setTurnOrderCallback: (cb: (order: TurnOrder) => void) => void;
  clearTurnOrderCallback: () => void;
}

export const CaptureContext = createContext<CaptureContextValue | null>(null);
