import { createContext } from 'react';
import type { DetectionResult, DuelCaptureState } from './types';

export interface CaptureContextValue {
  captureState: DuelCaptureState;
  pendingResult: DetectionResult | null;
  lastOcrResult: 'win' | 'loss' | null;
  consecutiveCount: number;
  isCapturing: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  confirm: () => void;
  dismiss: () => void;
  setResultCallback: (cb: (result: 'win' | 'loss') => void) => void;
  clearResultCallback: () => void;
}

export const CaptureContext = createContext<CaptureContextValue | null>(null);
