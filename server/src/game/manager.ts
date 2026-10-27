import { randomInt } from 'node:crypto';
import type { AdminSessionSummary } from '../../../shared/protocol.ts';
import * as questionSets from '../questionSets.ts';
import { GameError, GameSession } from './session.ts';

const SESSION_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const ENDED_SESSION_TTL_MS = 30 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

export class SessionManager {
  private readonly sessions = new Map<string, GameSession>();
  private readonly deleteListeners = new Set<(session: GameSession) => void>();
  private readonly sweeper: NodeJS.Timeout;

  constructor() {
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.sweeper.unref();
  }

  /** Called just before a session is removed, so the socket layer can notify clients. */
  onDelete(fn: (session: GameSession) => void): () => void {
    this.deleteListeners.add(fn);
    return () => this.deleteListeners.delete(fn);
  }

  createSession(questionSetId: string): GameSession {
    const set = questionSets.get(questionSetId);
    if (!set) throw new GameError('Question set not found');
    if (set.questions.length === 0) throw new GameError('Question set has no questions');
    const session = new GameSession(this.uniqueCode(), set);
    this.sessions.set(session.code, session);
    return session;
  }

  get(code: string): GameSession | undefined {
    return this.sessions.get(code);
  }

  delete(code: string): boolean {
    const session = this.sessions.get(code);
    if (!session) return false;
    for (const fn of this.deleteListeners) {
      try {
        fn(session);
      } catch (err) {
        console.error(`[manager] onDelete listener failed for ${code}`, err);
      }
    }
    this.sessions.delete(code);
    session.dispose();
    return true;
  }

  list(): AdminSessionSummary[] {
    return [...this.sessions.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((s) => ({
        code: s.code,
        phase: s.phase,
        questionSetName: s.questionSet.name,
        playerCount: s.players.size,
        currentIndex: s.currentIndex,
        totalQuestions: s.totalQuestions,
        createdAt: s.createdAt,
      }));
  }

  private uniqueCode(): string {
    for (let i = 0; i < 1000; i++) {
      const code = String(randomInt(100000, 1000000));
      if (!this.sessions.has(code)) return code;
    }
    throw new GameError('Could not allocate a session code');
  }

  private sweep(): void {
    const now = Date.now();
    for (const s of this.sessions.values()) {
      const tooOld = now - s.createdAt > SESSION_MAX_AGE_MS;
      const endedLongAgo = s.phase === 'ended' && s.endedAt !== null && now - s.endedAt > ENDED_SESSION_TTL_MS;
      if (tooOld || endedLongAgo) {
        console.log(`[manager] auto-deleting session ${s.code} (${tooOld ? 'expired' : 'ended'})`);
        this.delete(s.code);
      }
    }
  }
}
