import { useEffect, useRef, useState, useCallback, useReducer } from "react";
import { useOwnDecks } from "../../state/hooks/useOwnDecks";
import { useOpponentDecks } from "../../state/hooks/useOpponentDecks";
import { useTags } from "../../state/hooks/useTags";
import { useLatestRecord, useRecords } from "../../state/hooks/useRecords";
import { useBattlesStore } from "../../state/BattlesProvider";
import { useCaptureContext } from "../../capture/useCaptureContext";
import { captureLog } from "../../capture/captureLog";
import type { TurnOrderDetectionEvent } from "../../capture/types";
import type { BattleResult } from "../../types";
import Button from "../ui/Button";
import BattleFields from "./BattleFields";
import { createInitialBattleFormState, isBattleFormValid } from "./types";
import type { BattleFormState } from "./types";
import { battleFormReducer } from "./battleFormReducer";

interface BattleFormProps {
  suggestedResult?: BattleResult | null;
  onSuggestedResultConsumed?: () => void;
  capturePreviewResult?: BattleResult | null;
  onCapturePreviewResultConsumed?: () => void;
  suggestedTurnOrder?: TurnOrderDetectionEvent | null;
  onSuggestedTurnOrderConsumed?: () => void;
  suggestedScore?: number | null;
  onSuggestedScoreConsumed?: () => void;
  ratingConfirmToken?: number;
  onRecordSaved?: () => void;
  onTurnOrderCleared?: () => void;
}

export default function BattleForm({
  suggestedResult,
  onSuggestedResultConsumed,
  capturePreviewResult,
  onCapturePreviewResultConsumed,
  suggestedTurnOrder,
  onSuggestedTurnOrderConsumed,
  suggestedScore,
  onSuggestedScoreConsumed,
  ratingConfirmToken = 0,
  onRecordSaved,
  onTurnOrderCleared,
}: BattleFormProps) {
  const { captureRatingOnce, captureDpOnce, isCapturing, setPostResultScanMode } = useCaptureContext();
  const [isCapturingRating, setIsCapturingRating] = useState(false);
  const [captureRatingFailed, setCaptureRatingFailed] = useState(false);
  const store = useBattlesStore();
  const { items: ownDecks, add: addOwnDeck } = useOwnDecks();
  const { items: opponentDecks, add: addOpponentDeck } = useOpponentDecks();
  const { items: knownTags, add: addKnownTag } = useTags();
  const { add: addRecord } = useRecords();
  const latestRecord = useLatestRecord();

  const [state, dispatch] = useReducer(battleFormReducer, undefined, () => ({
    form: store.getDraftForm() ?? createInitialBattleFormState(latestRecord),
    pendingSubmit: null,
    captureResultApplied: false,
  }));
  const form = state.form;
  const [saved, setSaved] = useState(false);

  // キャプチャ中の DC モードでは結果反映時の ±1000 見積りをスキップし、画面 DP 検出に任せる。
  // 検出系 effect の依存に isCapturing を増やさないよう ref で参照する。
  const isCapturingRef = useRef(isCapturing);
  useEffect(() => {
    isCapturingRef.current = isCapturing;
  }, [isCapturing]);

  // 入力途中のコイントス結果・勝敗を共有ストアへ公開し、簡易戦績パネルと
  // 別ウィンドウのオーバーレイの両方に試合数・コイン勝率・全体/先攻/後攻を反映する。
  useEffect(() => {
    store.setDraftBattle({ turnOrder: form.turnOrder, result: form.result });
  }, [form.turnOrder, form.result, store]);

  // 記録タブを離れて再マウントされても入力途中フォームを失わないよう、
  // フォーム全体を共有ストアのメモリ上スタッシュへ退避する。
  useEffect(() => {
    store.setDraftForm(form);
  }, [form, store]);

  // 記録タブを離れたら入力途中表示を残さない。
  useEffect(
    () => () => store.setDraftBattle({ turnOrder: null, result: null }),
    [store],
  );

  // reducer が保存対象（pendingSubmit）を立てたら、ここで副作用を実行して確定する。
  // reducer が常に最新フォームから pendingSubmit を作るため、手動入力とキャプチャ自動入力が
  // 近接しても古いスナップショットから保存されない。consumedSubmitRef で二重発火を防ぐ。
  const consumedSubmitRef = useRef<BattleFormState | null>(null);
  useEffect(() => {
    const pending = state.pendingSubmit;
    if (!pending || consumedSubmitRef.current === pending) return;
    consumedSubmitRef.current = pending;
    addRecord({
      ownDeckId: pending.ownDeckId,
      opponentDeckId: pending.opponentDeckId,
      result: pending.result!,
      turnOrder: pending.turnOrder!,
      reasonTags: pending.reasonTags,
      memo: pending.memo,
      battleMode: pending.battleMode ?? undefined,
      score: pending.score !== "" ? Number(pending.score) : undefined,
    });
    // 保存済みレコードへ反映するのと同じバッチで入力途中分をクリアし、
    // 簡易戦績の一瞬の二重計上を防ぐ。
    store.setDraftBattle({ turnOrder: null, result: null });
    onRecordSaved?.();
    captureLog("battle-form", `submitForm: recorded ${pending.result}, form reset (result→null)`);
    dispatch({ type: "recordSaved" });
    setSaved(true);
    // pendingSubmit→null の再実行でメッセージが即消えないよう cleanup は付けない（旧実装と同等）。
    setTimeout(() => setSaved(false), 3000);
  }, [state.pendingSubmit, addRecord, onRecordSaved, store]);

  const suggestedScoreRef = useRef<number | null>(null);
  useEffect(() => {
    suggestedScoreRef.current = suggestedScore ?? null;
  }, [suggestedScore]);

  useEffect(() => {
    setPostResultScanMode(
      form.battleMode === 'rated' ? 'rating' : form.battleMode === 'duelists-cup' ? 'dp' : null,
    );
  }, [form.battleMode, setPostResultScanMode]);

  useEffect(() => {
    if (!suggestedResult) return;
    captureLog("battle-form", `result effect fire ${suggestedResult}`);
    queueMicrotask(() => {
      // reducer が勝敗反映・スコア空欄反映・自動送信判定（非rated/非DCの即確定）を一括で行う。
      dispatch({
        type: "captureResultDetected",
        result: suggestedResult,
        records: store.getState().records,
        skipAutoScore: isCapturingRef.current,
        suggestedScore: suggestedScoreRef.current,
      });
      onSuggestedResultConsumed?.();
    });
  }, [suggestedResult, store, onSuggestedResultConsumed]);

  useEffect(() => {
    if (!capturePreviewResult) return;
    captureLog("battle-form", `preview effect fire ${capturePreviewResult}`);
    queueMicrotask(() => {
      dispatch({
        type: "capturePreviewResultDetected",
        result: capturePreviewResult,
        records: store.getState().records,
        skipAutoScore: isCapturingRef.current,
      });
      onCapturePreviewResultConsumed?.();
    });
  }, [capturePreviewResult, store, onCapturePreviewResultConsumed]);

  const suggestedTurnOrderId = suggestedTurnOrder?.id;
  const suggestedTurnOrderValue = suggestedTurnOrder?.order;
  useEffect(() => {
    if (!suggestedTurnOrderId || !suggestedTurnOrderValue) return;
    queueMicrotask(() => {
      dispatch({ type: "captureTurnOrderDetected", order: suggestedTurnOrderValue });
      onSuggestedTurnOrderConsumed?.();
    });
  }, [suggestedTurnOrderId, suggestedTurnOrderValue, onSuggestedTurnOrderConsumed]);

  useEffect(() => {
    if (suggestedScore == null) return;
    queueMicrotask(() => {
      dispatch({ type: "captureScoreDetected", score: suggestedScore });
      onSuggestedScoreConsumed?.();
    });
  }, [suggestedScore, onSuggestedScoreConsumed]);

  const ratingConfirmTokenRef = useRef(ratingConfirmToken);
  useEffect(() => {
    if (ratingConfirmTokenRef.current === ratingConfirmToken) return;
    ratingConfirmTokenRef.current = ratingConfirmToken;
    queueMicrotask(() => {
      // 確定スコアを最新フォームへ反映し、valid なら reducer が pendingSubmit を立てる。
      dispatch({ type: "captureScoreConfirmed", score: suggestedScoreRef.current });
    });
  }, [ratingConfirmToken]);

  const isValid = isBattleFormValid(form);

  function handleFieldsChange(patch: Partial<BattleFormState>) {
    // turnOrder を手動解除したら turn order 検出を再開する（既存挙動を維持）。
    if (patch.turnOrder === null && form.turnOrder !== null) {
      onTurnOrderCleared?.();
    }
    dispatch({ type: "manualPatch", patch });
  }

  function handleAddOwnDeck(name: string) {
    const deck = addOwnDeck(name);
    dispatch({ type: "manualPatch", patch: { ownDeckId: deck.id } });
  }

  function handleAddOpponentDeck(name: string) {
    const deck = addOpponentDeck(name);
    dispatch({ type: "manualPatch", patch: { opponentDeckId: deck.id } });
  }

  function handleResultChange(result: BattleResult | null) {
    dispatch({
      type: "manualResultChange",
      result,
      records: store.getState().records,
      isCapturing,
    });
  }

  // 対戦モードに応じてレート / DP を画面から手動読み取りする。
  const handleCaptureScoreOnce = useCallback(async () => {
    setIsCapturingRating(true);
    setCaptureRatingFailed(false);
    try {
      const score =
        form.battleMode === 'duelists-cup'
          ? await captureDpOnce()
          : await captureRatingOnce();
      if (score !== null) {
        dispatch({ type: "manualPatch", patch: { score: String(score) } });
      } else {
        setCaptureRatingFailed(true);
        setTimeout(() => setCaptureRatingFailed(false), 3000);
      }
    } finally {
      setIsCapturingRating(false);
    }
  }, [captureRatingOnce, captureDpOnce, form.battleMode]);

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    dispatch({ type: "manualSubmitRequested" });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4 pb-4 max-w-4xl">
      <BattleFields
        value={form}
        onChange={handleFieldsChange}
        ownDecks={ownDecks}
        opponentDecks={opponentDecks}
        knownTags={knownTags}
        onAddOwnDeck={handleAddOwnDeck}
        onAddOpponentDeck={handleAddOpponentDeck}
        onAddKnownTag={addKnownTag}
        onResultChange={handleResultChange}
        onCaptureRating={isCapturing ? handleCaptureScoreOnce : undefined}
        isCapturingRating={isCapturingRating}
        captureRatingFailed={captureRatingFailed}
      />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!isValid}>
          記録する
        </Button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">
            記録しました！
          </span>
        )}
        {state.captureResultApplied && !isValid && !saved && (
          <span className="text-sm text-blue-600 font-medium">
            勝敗だけ反映しました。未入力を埋めると記録できます。
          </span>
        )}
      </div>
    </form>
  );
}
