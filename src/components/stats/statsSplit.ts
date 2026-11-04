import type { StatsSplitMode, WinLoss, WinLossBreakdown } from '../../hooks/useStats';

export const STATS_SPLIT_LABELS: Record<StatsSplitMode, [string, string]> = {
  coin: ['コイン表', 'コイン裏'],
  turn: ['先攻', '後攻'],
};

// 内訳モードに応じて [左, 右] の勝敗を返す。
export function pickSplit(stats: WinLossBreakdown, mode: StatsSplitMode): [WinLoss, WinLoss] {
  return mode === 'coin' ? [stats.coinHeads, stats.coinTails] : [stats.asFirst, stats.asSecond];
}
