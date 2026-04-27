import { useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { CaptureContext } from './captureContextValue';
import { getCaptureDebugEnabled } from './captureDebug';
import { useDuelCapture } from './useDuelCapture';

export function CaptureProvider({ children }: { children: ReactNode }) {
  const callbackRef = useRef<((result: 'win' | 'loss') => void) | null>(null);

  const handleResult = useCallback((result: 'win' | 'loss') => {
    callbackRef.current?.(result);
  }, []);

  const { videoRef, canvasRef, ...capture } = useDuelCapture(handleResult);
  const isCaptureDebugEnabled = getCaptureDebugEnabled();

  const setResultCallback = useCallback((cb: (result: 'win' | 'loss') => void) => {
    callbackRef.current = cb;
  }, []);

  const clearResultCallback = useCallback(() => {
    callbackRef.current = null;
  }, []);

  return (
    <CaptureContext.Provider
      value={{ ...capture, isCaptureDebugEnabled, setResultCallback, clearResultCallback }}
    >
      {children}
      <video ref={videoRef} hidden muted playsInline />
      <canvas ref={canvasRef} hidden />
    </CaptureContext.Provider>
  );
}
