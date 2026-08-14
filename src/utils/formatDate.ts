export function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString));
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

// タイムゾーン情報を持たない「見たままの日時」文字列（例: 2026-03-28T19:00:00）を返す。
// Excel のセルにはタイムゾーンの概念が無いため、UTC ではなくローカル時刻の
// 各要素をそのまま並べる必要がある。こうしないと JST のユーザーの戦績が
// アプリ表示（formatDate）より9時間ずれた状態で出力されてしまう。
export function toNaiveLocalISOString(isoString: string): string {
  const d = new Date(isoString);
  return (
    `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}
