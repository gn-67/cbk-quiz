import { nanoid } from 'nanoid';
import {
  CHOICE_COUNT,
  MAX_PLAYERS,
  QUESTION_PREVIEW_MS,
  type ChoiceIndex,
  type LeaderboardEntry,
  type Phase,
  type PlayerPublic,
  type PlayerState,
  type Question,
  type QuestionSet,
  type QuestionView,
  type RevealInfo,
  type SessionPublicState,
} from '../../../shared/protocol.ts';
import { generateUniqueName } from '../names.ts';

export interface PlayerAnswer {
  choice: ChoiceIndex;
  answeredAt: number;
  elapsedMs: number;
  /** null until the question is scored at reveal. */
  correct: boolean | null;
  points: number | null;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  streak: number;
  socketId: string | null;
  connected: boolean;
  joinedAt: number;
  /** Points earned on the most recently scored question. */
  lastGain: number;
  answers: Map<number, PlayerAnswer>;
}

export class GameError extends Error {}

const REVEALED_PHASES: ReadonlySet<Phase> = new Set(['reveal', 'leaderboard', 'podium']);

export class GameSession {
  readonly code: string;
  readonly questionSet: QuestionSet;
  readonly createdAt = Date.now();

  phase: Phase = 'lobby';
  currentIndex = -1;
  phaseStartedAt = Date.now();
  phaseEndsAt: number | null = null;
  endedAt: number | null = null;
  /** Origin (e.g. "https://quiz.example.com") captured from the first display/admin subscriber. */
  baseUrl: string | null = null;

  readonly players = new Map<string, Player>();

  private reveal: RevealInfo | null = null;
  private scoredCount = 0;
  private timer: NodeJS.Timeout | null = null;
  private disposed = false;
  private readonly listeners = new Set<() => void>();

  constructor(code: string, questionSet: QuestionSet) {
    this.code = code;
    // Snapshot so later edits to the stored set don't affect a live game.
    this.questionSet = structuredClone(questionSet);
  }

  // ---------- change notification ----------

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    if (this.disposed) return;
    for (const fn of this.listeners) {
      try {
        fn();
      } catch (err) {
        console.error(`[session ${this.code}] onChange listener failed`, err);
      }
    }
  }

  // ---------- timers ----------

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Schedules fn, which only runs if the session is still in the same phase+question when it fires. */
  private schedule(ms: number, fn: () => void): void {
    this.clearTimer();
    const phase = this.phase;
    const index = this.currentIndex;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.disposed || this.phase !== phase || this.currentIndex !== index) return;
      fn();
    }, Math.max(0, ms));
  }

  /** Stops all timers and detaches listeners. The session must not be used afterwards. */
  dispose(): void {
    this.clearTimer();
    this.disposed = true;
    this.listeners.clear();
  }

  // ---------- helpers ----------

  get totalQuestions(): number {
    return this.questionSet.questions.length;
  }

  get currentQuestion(): Question | null {
    return this.questionSet.questions[this.currentIndex] ?? null;
  }

  get isRevealed(): boolean {
    return REVEALED_PHASES.has(this.phase);
  }

  private setPhase(phase: Phase, durationMs: number | null): void {
    this.phase = phase;
    this.phaseStartedAt = Date.now();
    this.phaseEndsAt = durationMs === null ? null : this.phaseStartedAt + durationMs;
  }

  // ---------- admin transitions ----------

  start(): void {
    if (this.phase !== 'lobby') throw new GameError('Game has already started');
    if (this.totalQuestions < 1) throw new GameError('Question set has no questions');
    this.enterQuestion(0);
  }

  next(): void {
    switch (this.phase) {
      case 'lobby':
        throw new GameError('Use start');
      case 'question':
      case 'answers':
        this.enterReveal();
        return;
      case 'reveal':
        this.setPhase('leaderboard', null);
        this.notify();
        return;
      case 'leaderboard':
        if (this.currentIndex + 1 < this.totalQuestions) {
          this.enterQuestion(this.currentIndex + 1);
        } else {
          this.setPhase('podium', null);
          this.notify();
        }
        return;
      case 'podium':
        throw new GameError('Game is over, use end');
      case 'ended':
        throw new GameError('Session has ended');
    }
  }

  end(): void {
    if (this.phase === 'ended') return;
    this.clearTimer();
    this.setPhase('ended', null);
    this.endedAt = Date.now();
    this.notify();
  }

  // ---------- internal transitions ----------

  private enterQuestion(index: number): void {
    this.clearTimer();
    this.currentIndex = index;
    this.reveal = null;
    this.setPhase('question', QUESTION_PREVIEW_MS);
    this.schedule(QUESTION_PREVIEW_MS, () => this.enterAnswers());
    this.notify();
  }

  private enterAnswers(): void {
    const question = this.currentQuestion;
    if (!question) return;
    const limitMs = question.timeLimitSec * 1000;
    this.setPhase('answers', limitMs);
    this.schedule(limitMs, () => this.enterReveal());
    this.notify();
  }

  private enterReveal(): void {
    this.clearTimer();
    this.scoreCurrentQuestion();
    this.setPhase('reveal', null);
    this.notify();
  }

  private scoreCurrentQuestion(): void {
    const question = this.currentQuestion;
    if (!question) return;
    const limitMs = question.timeLimitSec * 1000;
    const counts: [number, number, number, number] = [0, 0, 0, 0];
    let totalAnswered = 0;

    for (const p of this.players.values()) {
      const a = p.answers.get(this.currentIndex);
      if (!a) {
        p.streak = 0;
        p.lastGain = 0;
        continue;
      }
      counts[a.choice] += 1;
      totalAnswered += 1;
      a.correct = a.choice === question.correctIndex;
      if (a.correct) {
        p.streak += 1;
        const speed = Math.round(500 * (1 - a.elapsedMs / limitMs));
        const base = Math.min(1000, Math.max(500, 500 + speed));
        const bonus = p.streak >= 2 ? 50 * Math.min(p.streak - 1, 5) : 0;
        a.points = base + bonus;
      } else {
        p.streak = 0;
        a.points = 0;
      }
      p.score += a.points;
      p.lastGain = a.points;
    }

    this.reveal = { correctIndex: question.correctIndex, counts, totalAnswered };
    this.scoredCount += 1;
  }

  // ---------- players ----------

  join(existingPlayerId: string | undefined, socketId: string): Player {
    if (this.phase === 'ended') throw new GameError('Session has ended');

    if (existingPlayerId) {
      const existing = this.players.get(existingPlayerId);
      if (existing) {
        existing.socketId = socketId;
        existing.connected = true;
        this.notify();
        return existing;
      }
    }

    if (this.players.size >= MAX_PLAYERS) throw new GameError('Lobby is full');

    const taken = new Set<string>();
    for (const p of this.players.values()) taken.add(p.name);

    const player: Player = {
      id: nanoid(12),
      name: generateUniqueName(taken),
      score: 0,
      streak: 0,
      socketId,
      connected: true,
      joinedAt: Date.now(),
      lastGain: 0,
      answers: new Map(),
    };
    this.players.set(player.id, player);
    this.notify();
    return player;
  }

  /** Marks a player offline but keeps them (and their score) so they can reattach. */
  disconnect(playerId: string, socketId?: string): void {
    const p = this.players.get(playerId);
    if (!p) return;
    // Ignore stale disconnects from a socket that has since been replaced by a reconnect.
    if (socketId && p.socketId !== socketId) return;
    p.connected = false;
    p.socketId = null;
    this.notify();
  }

  kick(playerId: string): Player | undefined {
    const p = this.players.get(playerId);
    if (!p) return undefined;
    this.players.delete(playerId);
    this.notify();
    return p;
  }

  submitAnswer(playerId: string, choice: ChoiceIndex): boolean {
    const p = this.players.get(playerId);
    if (!p) throw new GameError('Player not found');
    if (this.phase !== 'answers') return false;
    if (p.answers.has(this.currentIndex)) return false;
    if (!Number.isInteger(choice) || choice < 0 || choice >= CHOICE_COUNT) {
      throw new GameError('Invalid choice');
    }
    const question = this.currentQuestion;
    if (!question) return false;

    const now = Date.now();
    const limitMs = question.timeLimitSec * 1000;
    const elapsedMs = Math.min(limitMs, Math.max(0, now - this.phaseStartedAt));
    p.answers.set(this.currentIndex, { choice, answeredAt: now, elapsedMs, correct: null, points: null });

    if (this.allConnectedAnswered()) {
      this.enterReveal();
    } else {
      this.notify();
    }
    return true;
  }

  private allConnectedAnswered(): boolean {
    let connected = 0;
    for (const p of this.players.values()) {
      if (!p.connected) continue;
      connected += 1;
      if (!p.answers.has(this.currentIndex)) return false;
    }
    return connected > 0;
  }

  // ---------- derived views ----------

  private get answeredCount(): number {
    if (this.currentIndex < 0) return 0;
    let n = 0;
    for (const p of this.players.values()) if (p.answers.has(this.currentIndex)) n += 1;
    return n;
  }

  /** Players ordered by score desc then join order, with shared ranks (1, 1, 3). */
  private ranked(): Array<{ player: Player; rank: number }> {
    const sorted = [...this.players.values()].sort(
      (a, b) => b.score - a.score || a.joinedAt - b.joinedAt,
    );
    const out: Array<{ player: Player; rank: number }> = [];
    let rank = 0;
    sorted.forEach((player, i) => {
      if (i === 0 || player.score !== sorted[i - 1]!.score) rank = i + 1;
      out.push({ player, rank });
    });
    return out;
  }

  private leaderboard(limit: number): LeaderboardEntry[] {
    if (this.phase === 'lobby') return [];
    return this.ranked()
      .slice(0, limit)
      .map(({ player, rank }) => ({
        playerId: player.id,
        name: player.name,
        score: player.score,
        rank,
        lastGain: player.lastGain,
      }));
  }

  private rankOf(playerId: string): number | null {
    if (this.phase === 'lobby' || this.scoredCount === 0) return null;
    return this.ranked().find((r) => r.player.id === playerId)?.rank ?? null;
  }

  private questionView(): QuestionView | null {
    const question = this.currentQuestion;
    if (!question || this.phase === 'lobby' || this.phase === 'ended') return null;
    const view: QuestionView = {
      index: this.currentIndex,
      text: question.text,
      choices: [...question.choices],
      timeLimitSec: question.timeLimitSec,
    };
    if (this.isRevealed) view.correctIndex = question.correctIndex;
    return view;
  }

  toPublicState(joinUrl: string): SessionPublicState {
    const players: PlayerPublic[] = [...this.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({ id: p.id, name: p.name, score: p.score, connected: p.connected }));
    return {
      code: this.code,
      phase: this.phase,
      questionSetName: this.questionSet.name,
      totalQuestions: this.totalQuestions,
      currentIndex: this.currentIndex,
      phaseStartedAt: this.phaseStartedAt,
      phaseEndsAt: this.phaseEndsAt,
      serverNow: Date.now(),
      players,
      playerCount: players.length,
      connectedCount: players.filter((p) => p.connected).length,
      answeredCount: this.answeredCount,
      question: this.questionView(),
      reveal: this.isRevealed ? this.reveal : null,
      leaderboard: this.leaderboard(10),
      joinUrl,
      createdAt: this.createdAt,
    };
  }

  toPlayerState(playerId: string): PlayerState | null {
    const p = this.players.get(playerId);
    if (!p) return null;
    const rank = this.rankOf(playerId);
    const question = this.questionView();
    const a = question ? p.answers.get(this.currentIndex) : undefined;
    const revealed = this.isRevealed;
    return {
      playerId: p.id,
      name: p.name,
      code: this.code,
      phase: this.phase,
      score: p.score,
      rank,
      totalPlayers: this.players.size,
      currentIndex: this.currentIndex,
      totalQuestions: this.totalQuestions,
      phaseStartedAt: this.phaseStartedAt,
      phaseEndsAt: this.phaseEndsAt,
      serverNow: Date.now(),
      question,
      myAnswer: a
        ? {
            choice: a.choice,
            correct: revealed ? a.correct : null,
            pointsEarned: revealed ? a.points : null,
          }
        : null,
      lastGain: p.lastGain,
      streak: p.streak,
      isTopThree:
        (this.phase === 'leaderboard' || this.phase === 'podium') &&
        rank !== null && rank <= 3 && p.score > 0,
      leaderboard: this.leaderboard(3),
    };
  }
}
