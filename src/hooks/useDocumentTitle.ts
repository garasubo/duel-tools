import { useEffect } from 'react';

/**
 * SPA 遷移時に document.title を更新する。
 * クローラ向けの meta は各エントリ HTML が担うため、これは遷移後の UX 用。
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
