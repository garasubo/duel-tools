# capture モジュール

画面キャプチャと OCR を用いてデュエル結果・ターン順を自動検出するモジュール。

## 主な機能

- **結果検出**: `useOcrDetector` が英語 OCR で VICTORY / LOSE を検出し、`useDuelCapture` が連続一致を確認してから確定する。
- **コイントス検出**: `coinTossDetect.ts` が日本語 OCR（Tesseract.js）で先攻/後攻を判定する。ROI を画面下部（y=0.65〜0.85）に絞ることで複雑な背景に対する誤検知を抑制。
- **フォールバック**: コイントス検出が 60 秒以内に完了しない場合、デュエル中のバッジ領域（英語 OCR）からターン番号を読み取る。

## 主要ファイル

| ファイル | 役割 |
|---|---|
| `useDuelCapture.ts` | キャプチャ全体のオーケストレーション |
| `coinTossDetect.ts` | コイントス画面の OCR 解析 |
| `coinTossState.ts` | コイントス検出ステートマシン |
| `ocrDetect.ts` | 結果画面（VICTORY/LOSE）の OCR 解析 |
| `useOcrDetector.ts` | 英語 OCR ワーカーの管理 |

## テスト用フィクスチャ (`fixtures/`)

`coin_win_*`, `coin_lose_*`, `coin_first_*`, `coin_second_*`, `in_duel_*` の PNG を置くと自動検出される。
