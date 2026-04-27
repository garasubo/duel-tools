import { useContext } from 'react';
import { CaptureContext } from './captureContextValue';

export function useCaptureContext() {
  const ctx = useContext(CaptureContext);
  if (!ctx) throw new Error('useCaptureContext must be used within CaptureProvider');
  return ctx;
}
