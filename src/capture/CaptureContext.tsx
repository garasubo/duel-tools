import { useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { CaptureContext } from './captureContextValue';
import type { CaptureEvent, CaptureEventListener } from './captureEvents';
import { getCaptureDebugEnabled } from './captureDebug';
import { useDuelCapture } from './useDuelCapture';

export function CaptureProvider({ children }: { children: ReactNode }) {
  const listenersRef = useRef(new Set<CaptureEventListener>());

  const emit = useCallback((event: CaptureEvent) => {
    listenersRef.current.forEach((listener) => listener(event));
  }, []);

  const subscribeCaptureEvents = useCallback((listener: CaptureEventListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const { videoRef, canvasRef, ...capture } = useDuelCapture(emit);
  const isCaptureDebugEnabled = getCaptureDebugEnabled();

  return (
    <CaptureContext.Provider
      value={{
        ...capture,
        isCaptureDebugEnabled,
        subscribeCaptureEvents,
      }}
    >
      {children}
      <video ref={videoRef} hidden muted playsInline />
      <canvas ref={canvasRef} hidden />
    </CaptureContext.Provider>
  );
}
