const PLAYER_ID_STORAGE_KEY = 'atlas-cipher:player-id';

export function getPlayerId(): string {
  if (typeof window === 'undefined') {
    return 'server-player';
  }

  const existing = window.localStorage.getItem(PLAYER_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = createPlayerId();
  window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, created);
  return created;
}

export function getPlayerScopedStorageKey(key: string): string {
  return `${key}:${getPlayerId()}`;
}

function createPlayerId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `player_${crypto.randomUUID()}`;
  }

  return `player_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}