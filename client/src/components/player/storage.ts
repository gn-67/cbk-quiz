/** localStorage helpers for the player UI. All access is wrapped: Safari private mode can throw. */

export const LAST_CODE_KEY = 'cbc:lastCode';
export const playerKey = (code: string) => `cbc:player:${code}`;

export function getItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function removeItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Digits only, max 6 chars. */
export function normalizeCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}

/** Persist a successful join so a refresh / reopen keeps the same player. */
export function rememberPlayer(code: string, playerId: string) {
  setItem(playerKey(code), playerId);
  setItem(LAST_CODE_KEY, code);
}

/** Forget a session entirely (kicked, session deleted, or user chose to leave). */
export function forgetSession(code: string) {
  removeItem(playerKey(code));
  if (getItem(LAST_CODE_KEY) === code) removeItem(LAST_CODE_KEY);
}
