import { useCallback, useState } from 'react';
import type { BattleRecord, Deck } from '../types';
import { buildWorkbookSheets, type XlsxExportOptions } from '../utils/xlsxSheetData';
import { assembleWorkbook } from '../utils/xlsxWorkbook';

export type XlsxExportStatus = 'idle' | 'loading' | 'error';

type XlsxModule = typeof import('wasm-xlsxwriter/web');

// 動的 import で約1.4MBの wasm を初期バンドルから外す（Excel出力を使わない
// 初動率計算やオーバーレイのページでは読み込まれない）。初期化は1回だけ行い、
// 失敗した Promise はキャッシュに残さず次回クリックで再試行できるようにする。
let xlsxPromise: Promise<XlsxModule> | null = null;

function loadXlsx(): Promise<XlsxModule> {
  xlsxPromise ??= import('wasm-xlsxwriter/web')
    .then(async (mod) => {
      await mod.default();
      return mod;
    })
    .catch((e: unknown) => {
      xlsxPromise = null;
      throw e;
    });
  return xlsxPromise;
}

function downloadWorkbook(buffer: Uint8Array, filename: string) {
  // buffer は wasm のリニアメモリを参照するビューなので、slice() でコピーしてから Blob 化する。
  const blob = new Blob([buffer.slice()], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function useXlsxExport() {
  const [status, setStatus] = useState<XlsxExportStatus>('idle');

  const exportXlsx = useCallback(
    async (
      records: BattleRecord[],
      ownDecks: Deck[],
      opponentDecks: Deck[],
      options: XlsxExportOptions,
    ): Promise<boolean> => {
      setStatus('loading');
      try {
        const xlsx = await loadXlsx();
        const sheets = buildWorkbookSheets(records, ownDecks, opponentDecks, options);
        const buffer = assembleWorkbook(xlsx, sheets);
        downloadWorkbook(buffer, `duel-records-${new Date().toISOString().slice(0, 10)}.xlsx`);
        setStatus('idle');
        return true;
      } catch {
        setStatus('error');
        return false;
      }
    },
    [],
  );

  const reset = useCallback(() => setStatus('idle'), []);

  return { exportXlsx, status, reset };
}
