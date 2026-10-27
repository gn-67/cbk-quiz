/**
 * Admin helpers: password storage, authenticated REST fetch, and a socket
 * that is guaranteed to have completed `admin:auth` (re-authing on reconnect).
 */
import { getSocket, type AppSocket } from './socket';
import type { Ack, ClientToServerEvents } from '../../../shared/protocol';

const STORAGE_KEY = 'cbc:adminPassword';

// ---------- password storage (sessionStorage) ----------

export function getAdminPassword(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminPassword(password: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, password);
  } catch {
    /* private mode etc. — in-memory fallback below */
  }
  memoryPassword = password;
  // Password changed: force a fresh auth on the socket.
  authed = false;
  authPromise = null;
}

export function clearAdminPassword(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  memoryPassword = null;
  authed = false;
  authPromise = null;
}

let memoryPassword: string | null = null;
function currentPassword(): string | null {
  return getAdminPassword() ?? memoryPassword;
}

// ---------- REST ----------

/**
 * fetch() with the `x-admin-password` header and JSON handling.
 * Throws an Error carrying the server's message on non-2xx responses.
 */
export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  headers.set('x-admin-password', currentPassword() ?? '');
  const hasBody = init.body !== undefined && init.body !== null;
  if (hasBody && !headers.has('content-type')) headers.set('content-type', 'application/json');
  headers.set('accept', 'application/json');

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch {
    throw new Error('Network error — is the server running?');
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`.trim();
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      const m = d.error ?? d.message;
      if (typeof m === 'string' && m) message = m;
    } else if (typeof data === 'string' && data && data.length < 300) {
      message = data;
    }
    if (res.status === 401 || res.status === 403) message = `Unauthorized: ${message}`;
    throw new Error(message);
  }
  return data as T;
}

// ---------- Socket auth ----------

let authed = false; // true once admin:auth succeeded on the current connection
let authPromise: Promise<AppSocket> | null = null;
let listenersInstalled = false;
const authListeners = new Set<(ok: boolean, error?: string) => void>();

/** Subscribe to auth state changes (e.g. automatic re-auth after a reconnect). */
export function onAdminAuthChange(cb: (ok: boolean, error?: string) => void): () => void {
  authListeners.add(cb);
  return () => {
    authListeners.delete(cb);
  };
}

function notifyAuth(ok: boolean, error?: string) {
  authListeners.forEach((cb) => {
    try {
      cb(ok, error);
    } catch {
      /* ignore listener errors */
    }
  });
}

export function isAdminAuthed(): boolean {
  return authed && getSocket().connected;
}

function installListeners(socket: AppSocket) {
  if (listenersInstalled) return;
  listenersInstalled = true;
  socket.on('connect', () => {
    // Server-side auth state is lost on reconnect; re-auth automatically.
    authed = false;
    if (currentPassword()) {
      ensureAdminSocket().catch(() => {
        /* reported via notifyAuth */
      });
    }
  });
  socket.on('disconnect', () => {
    authed = false;
    authPromise = null;
  });
}

function waitConnected(socket: AppSocket, timeoutMs?: number): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      socket.off('connect', onConnect);
      if (timer) clearTimeout(timer);
    };
    socket.on('connect', onConnect);
    if (timeoutMs) {
      timer = setTimeout(() => {
        cleanup();
        reject(new Error('Could not connect to the server'));
      }, timeoutMs);
    }
    if (!socket.active) socket.connect();
  });
}

function doAuth(socket: AppSocket, password: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Server did not answer the sign-in request'));
    }, timeoutMs);
    socket.emit('admin:auth', { password }, (res: Ack) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (res.ok) resolve();
      else reject(new Error(res.error || 'Invalid admin password'));
    });
  });
}

/**
 * Resolves with the shared socket once it is connected AND has successfully
 * authenticated as admin with the stored password. The authed state is cached
 * per connection and re-established automatically after reconnects.
 */
export function ensureAdminSocket(opts: { timeoutMs?: number } = {}): Promise<AppSocket> {
  const socket = getSocket();
  installListeners(socket);
  if (authed && socket.connected) return Promise.resolve(socket);
  if (authPromise) return authPromise;

  const password = currentPassword();
  if (!password) return Promise.reject(new Error('No admin password set'));

  const connectTimeout = opts.timeoutMs; // undefined => wait indefinitely (auto re-auth path)
  const p = waitConnected(socket, connectTimeout)
    .then(() => doAuth(socket, password, 10000))
    .then(() => {
      authed = true;
      notifyAuth(true);
      return socket;
    })
    .catch((err: unknown) => {
      authed = false;
      const message = err instanceof Error ? err.message : String(err);
      notifyAuth(false, message);
      throw err instanceof Error ? err : new Error(message);
    })
    .finally(() => {
      if (authPromise === p) authPromise = null;
    });
  authPromise = p;
  return p;
}

// ---------- Typed emit-with-ack helper ----------

type AdminEvent = Extract<keyof ClientToServerEvents, `admin:${string}`>;
type EventArgs<K extends AdminEvent> = Parameters<ClientToServerEvents[K]>;
type AckFn<K extends AdminEvent> = EventArgs<K> extends [...infer _Rest, infer A] ? A : never;
type AckRes<K extends AdminEvent> = AckFn<K> extends (res: infer R) => void ? R : never;
type PayloadArgs<K extends AdminEvent> = EventArgs<K> extends [infer P, unknown] ? [payload: P] : [];
export type AdminOk<K extends AdminEvent> = Extract<AckRes<K>, { ok: true }>;

/**
 * Emit an admin event (after ensuring auth) and resolve with the successful ack
 * payload, or reject with an Error carrying the server's message / a timeout.
 */
export async function adminCall<K extends AdminEvent>(
  event: K,
  ...args: PayloadArgs<K>
): Promise<AdminOk<K>> {
  const socket = await ensureAdminSocket({ timeoutMs: 8000 });
  return new Promise<AdminOk<K>>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Server did not respond (timed out)'));
    }, 10000);
    const ack = (res: Ack<Record<string, unknown>>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (res.ok) resolve(res as unknown as AdminOk<K>);
      else reject(new Error(res.error || 'Request failed'));
    };
    // The protocol types are precise per event; this generic wrapper has to erase them.
    (socket.emit as unknown as (...a: unknown[]) => void)(event, ...args, ack);
  });
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Something went wrong';
}
