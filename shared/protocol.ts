/**
 * CBC Quiz — shared protocol between server and all clients.
 * THIS FILE IS THE CONTRACT. Server and every client import from here.
 * Do not change event names or payload shapes without updating all consumers.
 *
 * Game flow (one session):
 *   lobby --admin:start--> question(3s auto) --> answers(timeLimit, or all answered)
 *         --> reveal --admin:next--> leaderboard --admin:next--> question(next) ...
 *         after last question's leaderboard --admin:next--> podium --admin:end--> ended
 *   admin:next during question/answers immediately ends the timer and moves to reveal.
 *
 * Top-3 gold: during 'leaderboard' and 'podium' phases, players whose rank <= 3 (and score > 0)
 * get PlayerState.isTopThree = true and their whole screen renders bright gold.
 */

export const QUESTION_PREVIEW_MS = 3000; // show question text alone for 3s before answers appear
export const DEFAULT_TIME_LIMIT_SEC = 20;
export const MAX_PLAYERS = 200;
export const CHOICE_COUNT = 4;

export type Phase =
  | 'lobby'
  | 'question'     // question text only, 3 seconds
  | 'answers'      // 4 choices shown, players answer, timer running
  | 'reveal'       // correct answer + answer distribution
  | 'leaderboard'  // top players after this question (top 3 phones go gold)
  | 'podium'       // final results after last question (top 3 phones go gold)
  | 'ended';       // session closed by admin

export type ChoiceIndex = 0 | 1 | 2 | 3;

export interface Question {
  id: string;
  text: string;
  choices: [string, string, string, string];
  correctIndex: ChoiceIndex;
  timeLimitSec: number; // seconds players have once answers are shown
}

export interface QuestionSet {
  id: string;
  name: string;
  questions: Question[];
  createdAt: number;
  updatedAt: number;
}

/** Shape used when creating/updating a question set (ids optional, server fills them). */
export interface QuestionSetInput {
  name: string;
  questions: Array<Omit<Question, 'id' | 'timeLimitSec'> & { id?: string; timeLimitSec?: number }>;
}

export interface PlayerPublic {
  id: string;
  name: string;
  score: number;
  connected: boolean;
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  score: number;
  rank: number;      // 1-based, ties share rank
  lastGain: number;  // points earned on the most recent question
}

/** Question as visible to non-admin clients. correctIndex is only present from 'reveal' onward. */
export interface QuestionView {
  index: number;            // 0-based
  text: string;
  choices: [string, string, string, string];
  timeLimitSec: number;
  correctIndex?: ChoiceIndex;
}

export interface RevealInfo {
  correctIndex: ChoiceIndex;
  counts: [number, number, number, number]; // how many players picked each choice
  totalAnswered: number;
}

/** Broadcast to the display screen and admin for a session on every change. */
export interface SessionPublicState {
  code: string;
  phase: Phase;
  questionSetName: string;
  totalQuestions: number;
  currentIndex: number;          // -1 while in lobby
  phaseStartedAt: number;        // server epoch ms
  phaseEndsAt: number | null;    // server epoch ms; set for 'question' and 'answers'
  serverNow: number;             // server epoch ms at send time (clients compute clock offset)
  players: PlayerPublic[];       // all players (lobby list); sorted by join order
  playerCount: number;
  connectedCount: number;
  answeredCount: number;         // answers received for current question
  question: QuestionView | null; // present from 'question' phase through 'leaderboard'
  reveal: RevealInfo | null;     // present in 'reveal', 'leaderboard', 'podium'
  leaderboard: LeaderboardEntry[]; // top 10 by score (full podium ordering); present always (empty in lobby)
  joinUrl: string;               // absolute URL players should open (encoded in the QR)
  createdAt: number;
}

/** Sent to one player only. */
export interface PlayerState {
  playerId: string;
  name: string;
  code: string;
  phase: Phase;
  score: number;
  rank: number | null;           // null in lobby / before any scoring
  totalPlayers: number;
  currentIndex: number;
  totalQuestions: number;
  phaseStartedAt: number;
  phaseEndsAt: number | null;
  serverNow: number;
  question: QuestionView | null; // same visibility rules as SessionPublicState.question
  myAnswer: {
    choice: ChoiceIndex;
    correct: boolean | null;     // null until reveal
    pointsEarned: number | null; // null until reveal
  } | null;
  lastGain: number;              // points earned on most recent revealed question
  streak: number;                // consecutive correct answers
  isTopThree: boolean;           // TRUE => render the whole screen bright gold
  leaderboard: LeaderboardEntry[]; // top 3 only (for podium display on phone)
}

export interface AdminSessionSummary {
  code: string;
  phase: Phase;
  questionSetName: string;
  playerCount: number;
  currentIndex: number;
  totalQuestions: number;
  createdAt: number;
}

// ---------- Socket.IO events ----------

export type Ack<T = {}> = { ok: true } & T | { ok: false; error: string };

export interface ClientToServerEvents {
  // Player
  /** Join (or rejoin with existingPlayerId after a refresh/reconnect). Server assigns a random name. */
  'player:join': (
    payload: { code: string; existingPlayerId?: string },
    ack: (res: Ack<{ playerId: string; name: string; state: PlayerState }>) => void,
  ) => void;
  'player:answer': (
    payload: { choice: ChoiceIndex },
    ack: (res: Ack<{ accepted: boolean }>) => void,
  ) => void;
  'player:leave': () => void;

  // Display (projector screen)
  'display:subscribe': (
    payload: { code: string },
    ack: (res: Ack<{ state: SessionPublicState }>) => void,
  ) => void;

  // Admin (must call admin:auth first on this socket)
  'admin:auth': (payload: { password: string }, ack: (res: Ack) => void) => void;
  'admin:listSessions': (ack: (res: Ack<{ sessions: AdminSessionSummary[] }>) => void) => void;
  'admin:createSession': (
    payload: { questionSetId: string },
    ack: (res: Ack<{ code: string; state: SessionPublicState }>) => void,
  ) => void;
  /** Subscribe this admin socket to session:state updates for a code. */
  'admin:subscribe': (payload: { code: string }, ack: (res: Ack<{ state: SessionPublicState }>) => void) => void;
  'admin:start': (payload: { code: string }, ack: (res: Ack) => void) => void;
  'admin:next': (payload: { code: string }, ack: (res: Ack) => void) => void;
  'admin:end': (payload: { code: string }, ack: (res: Ack) => void) => void;
  'admin:deleteSession': (payload: { code: string }, ack: (res: Ack) => void) => void;
  'admin:kick': (payload: { code: string; playerId: string }, ack: (res: Ack) => void) => void;
}

export interface ServerToClientEvents {
  /** Display + admin subscribers of a session. */
  'session:state': (state: SessionPublicState) => void;
  /** Individual player. */
  'player:state': (state: PlayerState) => void;
  /** Player was kicked or session was deleted; client should return to join screen. */
  'player:kicked': (payload: { reason: string }) => void;
  /** Session deleted; display/admin should return to their home screen. */
  'session:deleted': (payload: { code: string }) => void;
}

// ---------- REST (admin only; header `x-admin-password`) ----------
// GET    /api/health                       -> { ok: true }
// GET    /api/question-sets                -> QuestionSet[]
// POST   /api/question-sets   body QuestionSetInput -> QuestionSet
// PUT    /api/question-sets/:id body QuestionSetInput -> QuestionSet
// DELETE /api/question-sets/:id            -> { ok: true }
// GET    /api/sessions/:code/exists        -> { exists: boolean, phase: Phase }  (public, used by join page)

// ---------- Scoring (server-side, documented so clients can explain it) ----------
// Correct answer: 500 + round(500 * (1 - elapsed / timeLimit))  => 500..1000, faster = more
// Streak bonus: +50 * min(streak - 1, 5) for 2+ correct in a row (max +250)
// Wrong / no answer: 0, streak resets.

export const ANSWER_COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c'] as const; // red, blue, yellow, green
export const ANSWER_SHAPES = ['triangle', 'diamond', 'circle', 'square'] as const;
