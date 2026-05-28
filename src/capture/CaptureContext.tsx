import { useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { TurnOrder } from '../types';
import { CaptureContext } from './captureContextValue';
import { getCaptureDebugEnabled } from './captureDebug';
import { useDuelCapture } from './useDuelCapture';

export function CaptureProvider({ children }: { children: ReactNode }) {
  const callbackRef = useRef<((result: 'win' | 'loss') => void) | null>(null);
  const previewCallbackRef = useRef<((result: 'win' | 'loss') => void) | null>(null);
  const turnOrderCallbackRef = useRef<((order: TurnOrder) => void) | null>(null);
  const ratingCallbackRef = useRef<((rating: number) => void) | null>(null);
  const ratingConfirmCallbackRef = useRef<((rating: number) => void) | null>(null);

  const handleResult = useCallback((result: 'win' | 'loss') => {
    callbackRef.current?.(result);
  }, []);

  const handleResultPreview = useCallback((result: 'win' | 'loss') => {
    previewCallbackRef.current?.(result);
  }, []);

  const handleTurnOrder = useCallback((order: TurnOrder) => {
    turnOrderCallbackRef.current?.(order);
  }, []);

  const handleRating = useCallback((rating: number) => {
    ratingCallbackRef.current?.(rating);
  }, []);

  const handleRatingConfirm = useCallback((rating: number) => {
    ratingConfirmCallbackRef.current?.(rating);
  }, []);

  const { videoRef, canvasRef, ...capture } = useDuelCapture(
    handleResult,
    handleTurnOrder,
    handleResultPreview,
    handleRating,
    handleRatingConfirm,
  );
  const isCaptureDebugEnabled = getCaptureDebugEnabled();

  const setResultCallback = useCallback((cb: (result: 'win' | 'loss') => void) => {
    callbackRef.current = cb;
  }, []);

  const clearResultCallback = useCallback(() => {
    callbackRef.current = null;
  }, []);

  const setResultPreviewCallback = useCallback((cb: (result: 'win' | 'loss') => void) => {
    previewCallbackRef.current = cb;
  }, []);

  const clearResultPreviewCallback = useCallback(() => {
    previewCallbackRef.current = null;
  }, []);

  const setTurnOrderCallback = useCallback((cb: (order: TurnOrder) => void) => {
    turnOrderCallbackRef.current = cb;
  }, []);

  const clearTurnOrderCallback = useCallback(() => {
    turnOrderCallbackRef.current = null;
  }, []);

  const setRatingCallback = useCallback((cb: (rating: number) => void) => {
    ratingCallbackRef.current = cb;
  }, []);

  const clearRatingCallback = useCallback(() => {
    ratingCallbackRef.current = null;
  }, []);

  const setRatingConfirmCallback = useCallback((cb: (rating: number) => void) => {
    ratingConfirmCallbackRef.current = cb;
  }, []);

  const clearRatingConfirmCallback = useCallback(() => {
    ratingConfirmCallbackRef.current = null;
  }, []);

  return (
    <CaptureContext.Provider
      value={{
        ...capture,
        isCaptureDebugEnabled,
        setResultCallback,
        clearResultCallback,
        setResultPreviewCallback,
        clearResultPreviewCallback,
        setTurnOrderCallback,
        clearTurnOrderCallback,
        setRatingCallback,
        clearRatingCallback,
        setRatingConfirmCallback,
        clearRatingConfirmCallback,
      }}
    >
      {children}
      <video ref={videoRef} hidden muted playsInline />
      <canvas ref={canvasRef} hidden />
    </CaptureContext.Provider>
  );
}
