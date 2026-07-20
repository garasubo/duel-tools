export const STORAGE_KEY = 'duel-tools-v1';
export const DRAFT_BATTLE_KEY = 'duel-tools-draft-battle-v1';

// 記録共有用 Cloudflare Worker のベース URL。
// ローカル開発では .env.local の VITE_SHARE_API_BASE=http://localhost:8787 で上書きする。
export const SHARE_API_BASE =
  import.meta.env.VITE_SHARE_API_BASE ??
  'https://duel-tools-share.garasubo.workers.dev';
