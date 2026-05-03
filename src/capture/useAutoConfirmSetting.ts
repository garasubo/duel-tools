import { useCallback, useState } from 'react';

export const AUTO_CONFIRM_STORAGE_KEY = 'duel-tools:auto-confirm-result';

type AutoConfirmStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readAutoConfirmEnabled(storage: AutoConfirmStorage | undefined = getStorage()): boolean {
  return storage?.getItem(AUTO_CONFIRM_STORAGE_KEY) === '1';
}

export function writeAutoConfirmEnabled(
  enabled: boolean,
  storage: AutoConfirmStorage | undefined = getStorage(),
): void {
  storage?.setItem(AUTO_CONFIRM_STORAGE_KEY, enabled ? '1' : '0');
}

function getStorage(): AutoConfirmStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
}

export function useAutoConfirmSetting() {
  const [autoConfirmEnabled, setAutoConfirmEnabledState] = useState(readAutoConfirmEnabled);

  const setAutoConfirmEnabled = useCallback((enabled: boolean) => {
    setAutoConfirmEnabledState(enabled);
    writeAutoConfirmEnabled(enabled);
  }, []);

  return { autoConfirmEnabled, setAutoConfirmEnabled };
}
