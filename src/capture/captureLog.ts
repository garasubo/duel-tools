import { getCaptureDebugEnabled } from './captureDebug';

// キャプチャ経路（検出ループ → ワークフロー → イベント → フォーム反映）の診断トレース。
// 既存の ?captureDebug=1 フラグが有効なときだけ console へ出力し、本番はゼロオーバーヘッド。
// 「Victory 検出なのにフォームの勝ちが反映されない」事象の発生時に、経路のどこで
// 途切れたかを 1 本のタイムスタンプ付きトレースで追えるようにする。
export function captureLog(scope: string, message: string, data?: unknown): void {
  if (!getCaptureDebugEnabled()) return;
  const ts = performance.now().toFixed(1);
  if (data !== undefined) {
    console.debug(`[capture ${ts}ms] ${scope}: ${message}`, data);
  } else {
    console.debug(`[capture ${ts}ms] ${scope}: ${message}`);
  }
}
