import type { BattleResult } from '../types';

// 自動記録ワークフローの状態機械。
// captureState の派生（旧 useDuelCapture のネスト三項）と isWaitingForRating の二重管理を
// 単一の source of truth に置き換える。
export type CaptureWorkflowState =
  | { phase: 'idle' }
  | { phase: 'scanning' }
  | { phase: 'result-detected'; result: BattleResult } // autoConfirm OFF: preview 反映後、結果画面の終了待ち
  | { phase: 'waiting-clear'; result: BattleResult } // autoConfirm ON: 結果画面の終了待ち
  | { phase: 'waiting-rating'; result: BattleResult } // rated: 結果確定後のレートスキャン中
  | { phase: 'waiting-dp'; result: BattleResult } // duelists-cup: 結果確定後の DP スキャン中
  | { phase: 'draining' }; // 記録保存後、結果画面が消えるまで再検出を止めるドレイン状態

export type CaptureWorkflowEvent =
  | { type: 'start' } // キャプチャ開始
  | { type: 'stop' } // キャプチャ停止
  | { type: 'record-saved' } // 記録保存（次のデュエルへ）
  | { type: 'result-confirmed'; result: BattleResult; autoConfirm: boolean } // 連続一致で確定
  | { type: 'manual-confirm' } // result-detected でユーザーが確定
  | { type: 'screen-cleared' }; // waiting-clear で結果画面が消えた

// 副作用は呼び出し側（useDuelCapture）で実行する intent。
export type CaptureWorkflowEffect =
  | { type: 'commit-result'; result: BattleResult } // フォームへ反映（外向き 'result' イベント発火）
  | { type: 'start-rating-loop' } // レート検出ループ開始（rated）
  | { type: 'start-dp-loop' }; // DP 検出ループ開始（duelists-cup）

export interface CaptureWorkflowContext {
  // 結果確定後にどのスコア検出を待つか。'rating'=レート戦 / 'dp'=DCモード / null=待たない。
  // 呼び出し側（= 対戦モード）から注入する。
  postResultScan: 'rating' | 'dp' | null;
}

export interface CaptureWorkflowResult {
  state: CaptureWorkflowState;
  effects: CaptureWorkflowEffect[];
}

export const INITIAL_CAPTURE_WORKFLOW_STATE: CaptureWorkflowState = { phase: 'idle' };

// 結果確定後の遷移。
function commitResult(
  result: BattleResult,
  ctx: CaptureWorkflowContext,
  options: { emitResult: boolean } = { emitResult: true },
): CaptureWorkflowResult {
  const commitEffects: CaptureWorkflowEffect[] = options.emitResult
    ? [{ type: 'commit-result', result }]
    : [];

  if (ctx.postResultScan === 'rating') {
    return {
      state: { phase: 'waiting-rating', result },
      effects: [...commitEffects, { type: 'start-rating-loop' }],
    };
  }
  if (ctx.postResultScan === 'dp') {
    return {
      state: { phase: 'waiting-dp', result },
      effects: [...commitEffects, { type: 'start-dp-loop' }],
    };
  }
  return {
    state: { phase: 'scanning' },
    effects: commitEffects,
  };
}

export function captureWorkflowReducer(
  state: CaptureWorkflowState,
  event: CaptureWorkflowEvent,
  ctx: CaptureWorkflowContext,
): CaptureWorkflowResult {
  // ライフサイクルイベントはどの状態からでも受け付ける。
  switch (event.type) {
    case 'stop':
      return { state: { phase: 'idle' }, effects: [] };
    case 'start':
      return { state: { phase: 'scanning' }, effects: [] };
    case 'record-saved':
      // キャプチャ未開始（idle）なら記録保存してもスキャンを開始しない。
      if (state.phase === 'idle') return { state, effects: [] };
      // 記録直後は勝敗確定画面がまだ表示されている可能性がある。直接 scanning に戻すと
      // 残っている VICTORY/LOSE を再検出して勝敗判定が再発火してしまうため、画面が消えるまで
      // 待つ draining 状態を経由する（旧ガード 8b98116 を新状態機械で復元）。
      return { state: { phase: 'draining' }, effects: [] };
  }

  switch (state.phase) {
    case 'scanning':
      if (event.type === 'result-confirmed') {
        return {
          state: event.autoConfirm
            ? { phase: 'waiting-clear', result: event.result }
            : { phase: 'result-detected', result: event.result },
          effects: [],
        };
      }
      return { state, effects: [] };

    case 'result-detected':
      // 結果検出ループは scanning を続けるため result-confirmed が再発火しうる（結果を更新）。
      if (event.type === 'result-confirmed') {
        return {
          state: event.autoConfirm
            ? { phase: 'waiting-clear', result: event.result }
            : { phase: 'result-detected', result: event.result },
          effects: [],
        };
      }
      if (event.type === 'manual-confirm') {
        return commitResult(state.result, ctx);
      }
      if (event.type === 'screen-cleared') {
        // 自動確定 OFF では result-preview が既にフォームへ勝敗を反映している。
        // ここで result イベントまで emit すると非レート戦で自動保存されうるため、
        // 画面終了後はスコア検出ループ開始だけ行う。
        return commitResult(state.result, ctx, { emitResult: false });
      }
      return { state, effects: [] };

    case 'waiting-clear':
      if (event.type === 'screen-cleared') {
        return commitResult(state.result, ctx);
      }
      return { state, effects: [] };

    case 'draining':
      // 結果画面が消えたら（gate モードの screen-cleared）再検出を再開する。
      // commit はしない（記録は既に保存済み）。検出イベントは無視して二重確定を防ぐ。
      if (event.type === 'screen-cleared') {
        return { state: { phase: 'scanning' }, effects: [] };
      }
      return { state, effects: [] };

    case 'idle':
    case 'waiting-rating':
    case 'waiting-dp':
      // 検出イベントは無視（waiting-rating / waiting-dp は record-saved / stop でのみ抜ける）。
      return { state, effects: [] };
  }
}
