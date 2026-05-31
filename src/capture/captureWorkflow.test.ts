import { describe, expect, it } from 'vitest';
import {
  INITIAL_CAPTURE_WORKFLOW_STATE,
  captureWorkflowReducer,
} from './captureWorkflow';
import type {
  CaptureWorkflowContext,
  CaptureWorkflowEvent,
  CaptureWorkflowState,
} from './captureWorkflow';

const NON_RATED: CaptureWorkflowContext = { rated: false };
const RATED: CaptureWorkflowContext = { rated: true };

function reduce(
  state: CaptureWorkflowState,
  event: CaptureWorkflowEvent,
  ctx: CaptureWorkflowContext = NON_RATED,
) {
  return captureWorkflowReducer(state, event, ctx);
}

describe('captureWorkflowReducer', () => {
  it('初期状態は idle', () => {
    expect(INITIAL_CAPTURE_WORKFLOW_STATE).toEqual({ phase: 'idle' });
  });

  it('start で scanning に入る', () => {
    expect(reduce({ phase: 'idle' }, { type: 'start' })).toEqual({
      state: { phase: 'scanning' },
      effects: [],
    });
  });

  it('stop はどの状態からでも idle に戻す', () => {
    const states: CaptureWorkflowState[] = [
      { phase: 'scanning' },
      { phase: 'result-detected', result: 'win' },
      { phase: 'waiting-clear', result: 'loss' },
      { phase: 'waiting-rating', result: 'win' },
    ];
    for (const state of states) {
      expect(reduce(state, { type: 'stop' }, RATED).state).toEqual({ phase: 'idle' });
    }
  });

  it('record-saved はキャプチャ中の状態から scanning に戻す（副作用なし）', () => {
    expect(reduce({ phase: 'waiting-rating', result: 'win' }, { type: 'record-saved' })).toEqual({
      state: { phase: 'scanning' },
      effects: [],
    });
  });

  it('record-saved は idle のときは idle のまま（スキャンを開始しない）', () => {
    expect(reduce({ phase: 'idle' }, { type: 'record-saved' })).toEqual({
      state: { phase: 'idle' },
      effects: [],
    });
  });

  it('idle 中の検出イベントは無視する', () => {
    expect(
      reduce({ phase: 'idle' }, { type: 'result-confirmed', result: 'win', autoConfirm: true }),
    ).toEqual({ state: { phase: 'idle' }, effects: [] });
  });

  describe('scanning からの result-confirmed', () => {
    it('autoConfirm OFF は result-detected へ', () => {
      expect(
        reduce({ phase: 'scanning' }, { type: 'result-confirmed', result: 'win', autoConfirm: false }),
      ).toEqual({ state: { phase: 'result-detected', result: 'win' }, effects: [] });
    });

    it('autoConfirm ON は waiting-clear へ（まだ commit しない）', () => {
      expect(
        reduce({ phase: 'scanning' }, { type: 'result-confirmed', result: 'loss', autoConfirm: true }),
      ).toEqual({ state: { phase: 'waiting-clear', result: 'loss' }, effects: [] });
    });
  });

  describe('result-detected', () => {
    it('result-confirmed の再発火で結果を更新する', () => {
      expect(
        reduce(
          { phase: 'result-detected', result: 'win' },
          { type: 'result-confirmed', result: 'loss', autoConfirm: false },
        ),
      ).toEqual({ state: { phase: 'result-detected', result: 'loss' }, effects: [] });
    });

    it('autoConfirm に切り替わると waiting-clear へ移る', () => {
      expect(
        reduce(
          { phase: 'result-detected', result: 'win' },
          { type: 'result-confirmed', result: 'win', autoConfirm: true },
        ),
      ).toEqual({ state: { phase: 'waiting-clear', result: 'win' }, effects: [] });
    });

    it('manual-confirm（非rated）は commit して scanning へ', () => {
      expect(reduce({ phase: 'result-detected', result: 'win' }, { type: 'manual-confirm' }, NON_RATED)).toEqual({
        state: { phase: 'scanning' },
        effects: [{ type: 'commit-result', result: 'win' }],
      });
    });

    it('manual-confirm（rated）は commit してレートループ開始・waiting-rating へ', () => {
      expect(reduce({ phase: 'result-detected', result: 'loss' }, { type: 'manual-confirm' }, RATED)).toEqual({
        state: { phase: 'waiting-rating', result: 'loss' },
        effects: [{ type: 'commit-result', result: 'loss' }, { type: 'start-rating-loop' }],
      });
    });
  });

  describe('waiting-clear からの screen-cleared', () => {
    it('非rated は commit して scanning へ', () => {
      expect(reduce({ phase: 'waiting-clear', result: 'win' }, { type: 'screen-cleared' }, NON_RATED)).toEqual({
        state: { phase: 'scanning' },
        effects: [{ type: 'commit-result', result: 'win' }],
      });
    });

    it('rated は commit してレートループ開始・waiting-rating へ', () => {
      expect(reduce({ phase: 'waiting-clear', result: 'loss' }, { type: 'screen-cleared' }, RATED)).toEqual({
        state: { phase: 'waiting-rating', result: 'loss' },
        effects: [{ type: 'commit-result', result: 'loss' }, { type: 'start-rating-loop' }],
      });
    });

    it('screen-cleared 以外では遷移しない', () => {
      const state: CaptureWorkflowState = { phase: 'waiting-clear', result: 'win' };
      expect(reduce(state, { type: 'result-confirmed', result: 'loss', autoConfirm: true })).toEqual({
        state,
        effects: [],
      });
    });
  });

  it('waiting-rating 中の検出イベントは無視する（record-saved/stop で抜ける）', () => {
    const state: CaptureWorkflowState = { phase: 'waiting-rating', result: 'win' };
    expect(reduce(state, { type: 'screen-cleared' }, RATED)).toEqual({ state, effects: [] });
    expect(reduce(state, { type: 'result-confirmed', result: 'loss', autoConfirm: true }, RATED)).toEqual({
      state,
      effects: [],
    });
  });
});
