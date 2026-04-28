import { useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { TurnOrder } from '../types';
import { CaptureContext } from './captureContextValue';
import { getCaptureDebugEnabled } from './captureDebug';
import { useDuelCapture } from './useDuelCapture';

export function CaptureProvider({ children }: { children: ReactNode }) {
  const callbackRef = useRef<((result: 'win' | 'loss') => void) | null>(null);
  const turnOrderCallbackRef = useRef<((order: TurnOrder) => void) | null>(null);

  const handleResult = useCallback((result: 'win' | 'loss') => {
    callbackRef.current?.(result);
  }, []);

  const handleTurnOrder = useCallback((order: TurnOrder) => {
    turnOrderCallbackRef.current?.(order);
  }, []);

  const { videoRef, canvasRef, ...capture } = useDuelCapture(handleResult, handleTurnOrder);
  const isCaptureDebugEnabled = getCaptureDebugEnabled();

  const setResultCallback = useCallback((cb: (result: 'win' | 'loss') => void) => {
    callbackRef.current = cb;
  }, []);

  const clearResultCallback = useCallback(() => {
    callbackRef.current = null;
  }, []);

  const setTurnOrderCallback = useCallback((cb: (order: TurnOrder) => void) => {
    turnOrderCallbackRef.current = cb;
  }, []);

  const clearTurnOrderCallback = useCallback(() => {
    turnOrderCallbackRef.current = null;
  }, []);

  return (
    <CaptureContext.Provider
      value={{
        ...capture,
        isCaptureDebugEnabled,
        setResultCallback,
        clearResultCallback,
        setTurnOrderCallback,
        clearTurnOrderCallback,
      }}
    >
      {children}
      <video ref={videoRef} hidden muted playsInline />
      <canvas ref={canvasRef} hidden />
    </CaptureContext.Provider>
  );
}
