# capture モジュール

画面キャプチャと OCR を用いてデュエル結果・ターン順を自動検出するモジュール。

## 主な機能

- **結果検出**: `useOcrDetector` が英語 OCR で VICTORY / LOSE を検出し、`useResultCaptureLoop` が連続一致を確認して候補を確定する。確定後の遷移（フォーム反映・レート待ち分岐）は後述のワークフロー状態機械が担う。サンプリングは目標 30fps（`CAPTURE_SAMPLE_INTERVAL_MS`）で、各フレームはまず安価な画像特徴ゲートを通り、OCR は曖昧フレーム（`possible`）のときだけ走る。確定条件は「連続回数」に加えて「最小経過時間」（`MIN_CONFIRM_DURATION_MS`）も要求するため、fps を上げても演出の一瞬のフラッシュを誤確定しない（確定的一致＝信頼度 ≥92 は従来通り 1 フレーム即確定）。
- **コイントス検出**: `useTurnOrderCaptureLoop` が日本語 OCR worker と 200ms 間隔の検出ループを管理し、`coinTossDetect.ts` が先攻/後攻を判定する。ROI を画面下部（y=0.65〜0.85）に絞ることで複雑な背景に対する誤検知を抑制。
- **レート戦の自動記録**: レート戦では「コイントス検出 → 勝敗確定 → レート検出 → 記録保存 → 次のコイントス検出」の順に進む。レート検出時は常に `BattleForm` の score 欄を自動で埋め、自動確定が ON の場合は続けて記録保存まで進める。OFF の場合はユーザーが「記録する」ボタンを押すまで `waiting-rating` 状態のまま待機する。レート検出ループはタイムアウトせず、記録保存・キャプチャ停止まで継続する。
- **フォールバック**: 相手選択画面を検出してから 30 秒以内に結果が出ない場合、デュエル中のバッジ領域を画像特徴量で判定する。判定できない場合はタイムアウト扱いで後攻とみなす。

## アーキテクチャ

検出ループ（結果・ターン順・レート）は「イベントを生成する」役割に徹し、状態と協調は中央で扱う。

- **ワークフロー状態機械** (`captureWorkflow.ts`): `idle → scanning → result-detected/waiting-clear → waiting-rating` の遷移を純粋 reducer で表現する単一の source of truth。`captureState` はこの phase から導出する。確定（`commit-result`）・レートループ開始（`start-rating-loop`）は reducer が返す effect として `useDuelCapture` が実行する。
- **イベントチャネル** (`captureEvents.ts`): 検出結果（result / result-preview / rating / rating-confirmed）を UI（`BattleForm`）へ届ける単一の購読チャネル `subscribeCaptureEvents`。`useDuelCapture` の `emit` が発火し、`RecordPage` が 1 箇所で購読する。ターン順は `turnOrderDetection`（state）経由で配布する。
- **結果検出ループ** (`useResultCaptureLoop.ts`): 内部状態を持たず、`runOnce(mode)` の `mode`（`'detect'` / `'gate'`）を呼び出し側が phase に応じて渡す。`'detect'` は連続一致で候補確定 → `onResultPreview`、`'gate'` は結果画面の終了検出 → `onResultScreenCleared`。

## 主要ファイル

| ファイル | 役割 |
|---|---|
| `useDuelCapture.ts` | キャプチャ全体のオーケストレーション（各ループ + ワークフロー reducer の駆動） |
| `captureWorkflow.ts` | 自動記録ワークフローの状態機械（純粋 reducer） |
| `captureEvents.ts` | 検出結果を UI へ届ける単一イベントチャネルの型 |
| `useResultCaptureLoop.ts` | 結果検出ループ（連続一致判定・画面終了ゲート、`runOnce(mode)`） |
| `useTurnOrderCaptureLoop.ts` | ターン順検出ループ、worker 破棄、fallback、デバッグ画像管理 |
| `useRatingCaptureLoop.ts` | レート検出ループ（連続一致判定） |
| `coinTossDetect.ts` | コイントス画面の OCR 解析 |
| `coinTossState.ts` | コイントス検出ステートマシン |
| `ocrDetect.ts` | 結果画面（VICTORY/LOSE）の OCR 解析 |
| `useOcrDetector.ts` | 英語 OCR ワーカーの管理 |
| `captureProfiler.ts` | 各処理（フレーム取得 / 画像特徴分類 / OCR）の所要時間と検出ループの実効 fps を計測する軽量プロファイラ（既定無効、captureDebug 有効時のみ集計） |

## パフォーマンス計測（captureDebug）

URL に `?captureDebug=1` を付けてキャプチャすると、`captureProfiler` が有効になり、`CaptureSection` のデバッグ表示に各処理の avg/max/last(ms) と検出ループの実効 fps が出る。30fps を出せているか・どの処理が 33ms 予算を食っているか（フレーム取得 / 画像特徴分類 / OCR）を確認できる。本番（debug 無効）では計測オーバーヘッドはかからない。

## テスト用フィクスチャ (`fixtures/`)

`coin_win_*`, `coin_lose_*`, `coin_first_*`, `coin_second_*`, `in_duel_*` の PNG を置くと自動検出される。
