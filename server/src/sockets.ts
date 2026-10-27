import type { Server, Socket } from 'socket.io';
import {
  CHOICE_COUNT,
  type Ack,
  type ChoiceIndex,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '../../shared/protocol.ts';
import { ADMIN_PASSWORD, safeEqual } from './auth.ts';
import type { SessionManager } from './game/manager.ts';
import { GameError, type GameSession } from './game/session.ts';

export interface SocketData {
  role: 'player' | 'display' | 'admin' | null;
  code: string | null;
  playerId: string | null;
  isAdmin: boolean;
}

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<never, never>, SocketData>;
type Sock = Socket<ClientToServerEvents, ServerToClientEvents, Record<never, never>, SocketData>;

const DEV_FALLBACK_BASE_URL = 'http://localhost:5173';

/**
 * PUBLIC_URL must be a full web address (e.g. https://my-app.onrender.com) or the QR code
 * is useless: phones treat a bare word like "my-app" as a search. Add https:// when the
 * scheme is missing, and ignore values that aren't a real hostname so we fall back to the
 * address the display/admin page was actually loaded from.
 */
function resolvePublicBaseUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    const host = url.hostname;
    if (host !== 'localhost' && !host.includes('.')) throw new Error('not a full hostname');
    return url.origin;
  } catch {
    console.warn(
      `[server] Ignoring PUBLIC_URL="${value}": it must be a full address like https://your-app.onrender.com. ` +
        'Falling back to the address the display page was opened from.',
    );
    return null;
  }
}

const PUBLIC_BASE_URL = resolvePublicBaseUrl(process.env.PUBLIC_URL);
/** Minimum spacing between broadcasts for one session; bursts of answers coalesce. */
const BROADCAST_THROTTLE_MS = 100;

const displayRoom = (code: string): string => `display:${code}`;

// ---------- payload parsing (payloads come from untrusted phones) ----------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function parseCode(payload: unknown): string {
  if (!isRecord(payload) || typeof payload.code !== 'string') throw new Error('Missing session code');
  const code = payload.code.trim();
  if (!/^\d{6}$/.test(code)) throw new Error('Invalid session code');
  return code;
}

function parseChoice(payload: unknown): ChoiceIndex {
  const c = isRecord(payload) ? payload.choice : undefined;
  if (typeof c !== 'number' || !Number.isInteger(c) || c < 0 || c >= CHOICE_COUNT) {
    throw new Error('Invalid choice');
  }
  return c as ChoiceIndex;
}

function parseOptionalString(payload: unknown, key: string, max = 64): string | undefined {
  if (!isRecord(payload)) return undefined;
  const v = payload[key];
  return typeof v === 'string' && v.length > 0 && v.length <= max ? v : undefined;
}

/**
 * Wraps a handler so that: a missing/non-function ack never throws, thrown errors
 * become {ok:false,error}, and the ack is always called at most once.
 */
function handle<T>(
  socket: Sock,
  event: string,
  fn: (payload: unknown) => Ack<T>,
): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    const ack = args.find((a): a is (res: Ack<T>) => void => typeof a === 'function');
    const payload = typeof args[0] === 'function' ? undefined : args[0];
    let res: Ack<T>;
    try {
      res = fn(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      res = { ok: false, error: message };
      // Plain Errors / GameErrors are expected validation or game-rule failures; only log surprises.
      const expected = err instanceof GameError || (err instanceof Error && err.constructor === Error);
      if (!expected) console.error(`[socket ${socket.id}] ${event} failed`, err);
    }
    if (ack) {
      try {
        ack(res);
      } catch (err) {
        console.error(`[socket ${socket.id}] ${event} ack threw`, err);
      }
    }
  };
}

// ---------- join URL ----------

function firstHeader(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.split(',')[0]?.trim() || undefined;
}

/** Best guess at the origin the client's page was loaded from (works behind a reverse proxy). */
function inferBaseUrl(socket: Sock): string | null {
  const h = socket.handshake.headers;
  const origin = firstHeader(h.origin);
  if (origin && origin !== 'null' && /^https?:\/\//.test(origin)) return origin.replace(/\/+$/, '');
  const host = firstHeader(h['x-forwarded-host']) ?? firstHeader(h.host);
  if (!host) return null;
  const proto = firstHeader(h['x-forwarded-proto']) ?? (socket.handshake.secure ? 'https' : 'http');
  return `${proto}://${host}`;
}

function joinUrlFor(session: GameSession): string {
  const base = (PUBLIC_BASE_URL || session.baseUrl || DEV_FALLBACK_BASE_URL).replace(/\/+$/, '');
  return `${base}/?code=${session.code}`;
}

function captureBaseUrl(session: GameSession, socket: Sock): void {
  if (!session.baseUrl) session.baseUrl = inferBaseUrl(socket);
}

// ---------- wiring ----------

export function attachSockets(io: IO, manager: SessionManager): void {
  const throttles = new Map<string, { timer: NodeJS.Timeout; dirty: boolean }>();

  function broadcast(session: GameSession): void {
    io.to(displayRoom(session.code)).emit('session:state', session.toPublicState(joinUrlFor(session)));
    for (const p of session.players.values()) {
      if (!p.socketId) continue;
      const s = io.sockets.sockets.get(p.socketId);
      if (!s) continue;
      const state = session.toPlayerState(p.id);
      if (state) s.emit('player:state', state);
    }
  }

  /** Leading + trailing throttle: phase changes go out immediately, answer bursts coalesce. */
  function scheduleBroadcast(session: GameSession): void {
    const code = session.code;
    const pending = throttles.get(code);
    if (pending) {
      pending.dirty = true;
      return;
    }
    broadcast(session);
    const entry = {
      dirty: false,
      timer: setTimeout(() => {
        throttles.delete(code);
        if (entry.dirty && manager.get(code) === session) broadcast(session);
      }, BROADCAST_THROTTLE_MS),
    };
    throttles.set(code, entry);
  }

  function track(session: GameSession): void {
    session.onChange(() => scheduleBroadcast(session));
  }

  manager.onDelete((session) => {
    const pending = throttles.get(session.code);
    if (pending) {
      clearTimeout(pending.timer);
      throttles.delete(session.code);
    }
    io.to(displayRoom(session.code)).emit('session:deleted', { code: session.code });
    for (const p of session.players.values()) {
      if (!p.socketId) continue;
      const s = io.sockets.sockets.get(p.socketId);
      if (!s) continue;
      s.emit('player:kicked', { reason: 'Session was deleted' });
      s.data.code = null;
      s.data.playerId = null;
    }
    io.in(displayRoom(session.code)).socketsLeave(displayRoom(session.code));
  });

  io.on('connection', (socket) => {
    socket.data.role = null;
    socket.data.code = null;
    socket.data.playerId = null;
    socket.data.isAdmin = false;

    const requireSession = (code: string): GameSession => {
      const session = manager.get(code);
      if (!session) throw new Error('Session not found');
      return session;
    };

    const requireAdmin = (): void => {
      if (!socket.data.isAdmin) throw new Error('Unauthorized');
    };

    /** Detach this socket from whatever player it currently represents. */
    const detachPlayer = (): void => {
      const { code, playerId } = socket.data;
      if (code && playerId) manager.get(code)?.disconnect(playerId, socket.id);
      socket.data.code = null;
      socket.data.playerId = null;
    };

    // ----- player -----

    socket.on('player:join', handle(socket, 'player:join', (payload) => {
      const code = parseCode(payload);
      const existingPlayerId = parseOptionalString(payload, 'existingPlayerId');
      const session = requireSession(code);
      if (socket.data.playerId && (socket.data.code !== code || socket.data.playerId !== existingPlayerId)) {
        detachPlayer();
      }
      const player = session.join(existingPlayerId, socket.id);
      socket.data.role = 'player';
      socket.data.code = code;
      socket.data.playerId = player.id;
      const state = session.toPlayerState(player.id);
      if (!state) throw new Error('Failed to build player state');
      return { ok: true, playerId: player.id, name: player.name, state };
    }));

    socket.on('player:answer', handle(socket, 'player:answer', (payload) => {
      const choice = parseChoice(payload);
      const { code, playerId } = socket.data;
      if (!code || !playerId) throw new Error('Not joined');
      const session = requireSession(code);
      const accepted = session.submitAnswer(playerId, choice);
      return { ok: true, accepted };
    }));

    socket.on('player:leave', () => {
      try {
        const { code, playerId } = socket.data;
        if (code && playerId) manager.get(code)?.kick(playerId);
        socket.data.code = null;
        socket.data.playerId = null;
        socket.data.role = null;
      } catch (err) {
        console.error(`[socket ${socket.id}] player:leave failed`, err);
      }
    });

    // ----- display -----

    socket.on('display:subscribe', handle(socket, 'display:subscribe', (payload) => {
      const code = parseCode(payload);
      const session = requireSession(code);
      if (socket.data.code && socket.data.code !== code && socket.data.role !== 'player') {
        void socket.leave(displayRoom(socket.data.code));
      }
      captureBaseUrl(session, socket);
      void socket.join(displayRoom(code));
      if (socket.data.role !== 'admin') socket.data.role = 'display';
      socket.data.code = code;
      return { ok: true, state: session.toPublicState(joinUrlFor(session)) };
    }));

    // ----- admin -----

    socket.on('admin:auth', handle(socket, 'admin:auth', (payload) => {
      const password = isRecord(payload) && typeof payload.password === 'string' ? payload.password : '';
      if (!safeEqual(password, ADMIN_PASSWORD)) throw new Error('Unauthorized');
      socket.data.isAdmin = true;
      socket.data.role = 'admin';
      return { ok: true };
    }));

    socket.on('admin:listSessions', handle(socket, 'admin:listSessions', () => {
      requireAdmin();
      return { ok: true, sessions: manager.list() };
    }));

    socket.on('admin:createSession', handle(socket, 'admin:createSession', (payload) => {
      requireAdmin();
      const questionSetId = parseOptionalString(payload, 'questionSetId', 128);
      if (!questionSetId) throw new Error('Missing questionSetId');
      const session = manager.createSession(questionSetId);
      track(session);
      captureBaseUrl(session, socket);
      console.log(`[session ${session.code}] created from "${session.questionSet.name}"`);
      return { ok: true, code: session.code, state: session.toPublicState(joinUrlFor(session)) };
    }));

    socket.on('admin:subscribe', handle(socket, 'admin:subscribe', (payload) => {
      requireAdmin();
      const code = parseCode(payload);
      const session = requireSession(code);
      if (socket.data.code && socket.data.code !== code) void socket.leave(displayRoom(socket.data.code));
      captureBaseUrl(session, socket);
      void socket.join(displayRoom(code));
      socket.data.code = code;
      return { ok: true, state: session.toPublicState(joinUrlFor(session)) };
    }));

    socket.on('admin:start', handle(socket, 'admin:start', (payload) => {
      requireAdmin();
      requireSession(parseCode(payload)).start();
      return { ok: true };
    }));

    socket.on('admin:next', handle(socket, 'admin:next', (payload) => {
      requireAdmin();
      requireSession(parseCode(payload)).next();
      return { ok: true };
    }));

    socket.on('admin:end', handle(socket, 'admin:end', (payload) => {
      requireAdmin();
      requireSession(parseCode(payload)).end();
      return { ok: true };
    }));

    socket.on('admin:deleteSession', handle(socket, 'admin:deleteSession', (payload) => {
      requireAdmin();
      const code = parseCode(payload);
      if (!manager.delete(code)) throw new Error('Session not found');
      console.log(`[session ${code}] deleted by admin`);
      return { ok: true };
    }));

    socket.on('admin:kick', handle(socket, 'admin:kick', (payload) => {
      requireAdmin();
      const code = parseCode(payload);
      const playerId = parseOptionalString(payload, 'playerId');
      if (!playerId) throw new Error('Missing playerId');
      const session = requireSession(code);
      const player = session.kick(playerId);
      if (!player) throw new Error('Player not found');
      if (player.socketId) {
        const s = io.sockets.sockets.get(player.socketId);
        if (s) {
          s.emit('player:kicked', { reason: 'You were removed by the host' });
          s.data.code = null;
          s.data.playerId = null;
        }
      }
      return { ok: true };
    }));

    socket.on('disconnect', () => {
      try {
        detachPlayer();
      } catch (err) {
        console.error(`[socket ${socket.id}] disconnect cleanup failed`, err);
      }
    });
  });
}
