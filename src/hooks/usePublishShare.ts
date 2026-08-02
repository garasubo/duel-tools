import { useCallback, useState } from 'react';
import { useBattlesStore } from '../state/BattlesProvider';
import { buildSharedSnapshot } from '../utils/share';
import { SHARE_API_BASE } from '../utils/constants';

type PublishStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * ローカルの全記録を共有スナップショットとして Worker に公開し、
 * 読み取り専用の共有 URL を返す。フィルタには依存せず常に全記録を公開する。
 */
export function usePublishShare() {
  const store = useBattlesStore();
  const [status, setStatus] = useState<PublishStatus>('idle');
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const publish = useCallback(
    async (title?: string) => {
      setStatus('loading');
      setShareUrl(null);
      try {
        const snapshot = buildSharedSnapshot(store.getState(), title);
        const res = await fetch(`${SHARE_API_BASE}/shares`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshot),
        });
        if (!res.ok) {
          setStatus('error');
          return;
        }
        const data = (await res.json()) as { id?: unknown };
        if (typeof data.id !== 'string' || data.id === '') {
          setStatus('error');
          return;
        }
        const url = `${window.location.origin}${import.meta.env.BASE_URL}record/shared/${data.id}`;
        setShareUrl(url);
        setStatus('success');
      } catch {
        setStatus('error');
      }
    },
    [store],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setShareUrl(null);
  }, []);

  return { publish, status, shareUrl, reset };
}
