/**
 * End-to-end load test: 1 admin + 1 display + N simulated players run a full game.
 * Usage: PLAYERS=200 URL=http://localhost:3001 ADMIN_PASSWORD=cbc-admin npx tsx scripts/loadtest.ts
 * Exits non-zero on any assertion failure.
 */
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents, ServerToClientEvents, PlayerState, SessionPublicState, ChoiceIndex, Ack,
} from '../shared/protocol.ts';

type S = Socket<ServerToClientEvents, ClientToServerEvents>;
const URL = process.env.URL ?? 'http://localhost:3001';
const N = Number(process.env.PLAYERS ?? 200);
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'cbc-admin';

const failures: string[] = [];
const assert = (cond: unknown, msg: string) => { if (!cond) { failures.push(msg); console.error('ASSERT FAIL:', msg); } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mk = (): S => io(URL, { transports: ['websocket'], forceNew: true, reconnection: true });
const emitAck = <T,>(fn: (ack: (r: Ack<T>) => void) => void): Promise<Ack<T>> =>
  new Promise((resolve) => { const t = setTimeout(() => resolve({ ok: false, error: 'ack timeout' }), 10000); fn((r) => { clearTimeout(t); resolve(r); }); });
const waitFor = <T,>(get: () => T | undefined, pred: (v: T) => boolean, timeoutMs: number, label: string): Promise<T | undefined> =>
  new Promise((resolve) => {
    const start = Date.now();
    const iv = setInterval(() => {
      const v = get();
      if (v !== undefined && pred(v)) { clearInterval(iv); resolve(v); }
      else if (Date.now() - start > timeoutMs) { clearInterval(iv); assert(false, `timeout waiting for ${label}`); resolve(v); }
    }, 50);
  });

async function main() {
  const t0 = Date.now();
  // ---- admin
  const admin = mk();
  await new Promise<void>((r) => admin.on('connect', () => r()));
  const auth = await emitAck<{}>((ack) => admin.emit('admin:auth', { password: PASSWORD }, ack));
  assert(auth.ok, `admin auth: ${JSON.stringify(auth)}`);
  const setsRes = await fetch(`${URL}/api/question-sets`, { headers: { 'x-admin-password': PASSWORD } });
  const sets = (await setsRes.json()) as Array<{ id: string; name: string; questions: unknown[] }>;
  assert(Array.isArray(sets) && sets.length > 0, 'at least one question set exists');
  const created = await emitAck<{ code: string; state: SessionPublicState }>((ack) => admin.emit('admin:createSession', { questionSetId: sets[0].id }, ack));
  if (!created.ok) throw new Error('createSession failed: ' + created.error);
  const code = created.code;
  let adminState: SessionPublicState | undefined = created.state;
  admin.on('session:state', (s) => { adminState = s; });
  const sub = await emitAck<{ state: SessionPublicState }>((ack) => admin.emit('admin:subscribe', { code }, ack));
  assert(sub.ok, 'admin subscribe');
  console.log(`session ${code} with ${created.state.totalQuestions} questions; joinUrl=${created.state.joinUrl}`);

  // ---- display
  const display = mk();
  let displayState: SessionPublicState | undefined;
  display.on('session:state', (s) => { displayState = s; });
  const dsub = await emitAck<{ state: SessionPublicState }>((ack) => display.emit('display:subscribe', { code }, ack));
  assert(dsub.ok, 'display subscribe');

  // ---- players
  const players: { s: S; id: string; name: string; state?: PlayerState; updates: number }[] = [];
  const tJoin = Date.now();
  await Promise.all(Array.from({ length: N }, async (_, i) => {
    const s = mk();
    const p = { s, id: '', name: '', state: undefined as PlayerState | undefined, updates: 0 };
    s.on('player:state', (st) => { p.state = st; p.updates++; });
    const res = await emitAck<{ playerId: string; name: string; state: PlayerState }>((ack) => s.emit('player:join', { code }, ack));
    if (!res.ok) { assert(false, `player ${i} join failed: ${res.error}`); return; }
    p.id = res.playerId; p.name = res.name; p.state = res.state;
    players.push(p);
  }));
  console.log(`${players.length}/${N} players joined in ${Date.now() - tJoin}ms`);
  assert(players.length === N, 'all players joined');
  assert(new Set(players.map((p) => p.name)).size === players.length, 'player names unique');

  // 201st player should be rejected when N == MAX
  if (N >= 200) {
    const extra = mk();
    const r = await emitAck<{ playerId: string }>((ack) => extra.emit('player:join', { code }, ack));
    assert(!r.ok, '201st player rejected (lobby full)');
    extra.close();
  }

  await waitFor(() => displayState, (s) => s.playerCount === N, 5000, 'display sees all players');
  assert(displayState?.phase === 'lobby', 'display in lobby');

  // reconnect test: player 0 disconnects and rejoins with existingPlayerId, keeps identity
  {
    const p = players[0];
    p.s.close();
    const s2 = mk();
    s2.on('player:state', (st) => { p.state = st; p.updates++; });
    const r = await emitAck<{ playerId: string; name: string; state: PlayerState }>((ack) => s2.emit('player:join', { code, existingPlayerId: p.id }, ack));
    assert(r.ok && r.playerId === p.id && r.name === p.name, 'rejoin keeps id and name');
    p.s = s2;
  }

  // ---- play through every question
  const total = created.state.totalQuestions;
  const start = await emitAck<{}>((ack) => admin.emit('admin:start', { code }, ack));
  assert(start.ok, `admin start: ${JSON.stringify(start)}`);
  for (let q = 0; q < total; q++) {
    const qs = await waitFor(() => adminState, (s) => s.phase === 'question' && s.currentIndex === q, 8000, `question phase q${q}`);
    assert(qs?.question && qs.question.correctIndex === undefined, `q${q}: correctIndex hidden during question phase`);
    const tq = Date.now();
    const as = await waitFor(() => adminState, (s) => s.phase === 'answers' && s.currentIndex === q, 8000, `answers phase q${q}`);
    const previewMs = Date.now() - tq;
    assert(previewMs > 2500 && previewMs < 4500, `q${q}: question preview ~3s (got ${previewMs}ms)`);
    // players: first 150 answer at random times within 2s, 30 answer the "correct guess" late, 20 never answer
    const correctGuess = (q % 4) as ChoiceIndex; // unknown to clients; random choice distribution anyway
    await waitFor(() => players[5]?.state, (s) => s.phase === 'answers', 3000, 'player sees answers phase');
    const tA = Date.now();
    await Promise.all(players.map(async (p, i) => {
      if (i >= N - 20 && N > 40) return; // non-answerers
      await sleep(Math.random() * 1500);
      const choice = ((i + q) % 4) as ChoiceIndex;
      const r = await emitAck<{ accepted: boolean }>((ack) => p.s.emit('player:answer', { choice }, ack));
      assert(r.ok, `q${q} player ${i} answer ok: ${JSON.stringify(r)}`);
    }));
    void correctGuess;
    console.log(`q${q}: answers sent in ${Date.now() - tA}ms`);
    // duplicate answer rejected or ignored
    const dup = await emitAck<{ accepted: boolean }>((ack) => players[1].s.emit('player:answer', { choice: 0 }, ack));
    assert(!dup.ok || dup.accepted === false, 'duplicate answer not accepted');
    const answered = await waitFor(() => adminState, (s) => s.answeredCount >= Math.min(N, N - (N > 40 ? 20 : 0)), 5000, `answeredCount q${q}`);
    // skip the remaining timer
    const nx = await emitAck<{}>((ack) => admin.emit('admin:next', { code }, ack));
    assert(nx.ok, 'admin next -> reveal');
    const rv = await waitFor(() => adminState, (s) => s.phase === 'reveal' && s.currentIndex === q, 5000, `reveal q${q}`);
    assert(rv?.reveal && rv.question?.correctIndex !== undefined, `q${q}: reveal has correctIndex`);
    if (rv?.reveal) {
      const sum = rv.reveal.counts.reduce((a, b) => a + b, 0);
      assert(sum === (answered?.answeredCount ?? -1), `q${q}: reveal counts sum (${sum}) == answeredCount (${answered?.answeredCount})`);
    }
    await waitFor(() => players[2].state, (s) => s.phase === 'reveal' && s.myAnswer?.correct !== null, 3000, 'player reveal has correctness');
    const p2 = players[2].state!;
    if (p2.myAnswer?.correct) assert((p2.myAnswer.pointsEarned ?? 0) >= 500, 'correct answer >= 500 pts');
    else assert((p2.myAnswer?.pointsEarned ?? 0) === 0, 'wrong answer 0 pts');
    const lb = await emitAck<{}>((ack) => admin.emit('admin:next', { code }, ack));
    assert(lb.ok, 'admin next -> leaderboard');
    const ls = await waitFor(() => adminState, (s) => s.phase === 'leaderboard' && s.currentIndex === q, 5000, `leaderboard q${q}`);
    assert(ls && ls.leaderboard.length > 0 && ls.leaderboard.length <= 10, 'leaderboard top 10');
    await waitFor(() => players[3].state, (s) => s.phase === 'leaderboard', 3000, 'players see leaderboard');
    await sleep(150);
    // gold check: exactly the players with rank<=3 && score>0 have isTopThree
    const gold = players.filter((p) => p.state?.isTopThree);
    const expectedGold = players.filter((p) => p.state && p.state.rank !== null && p.state.rank <= 3 && p.state.score > 0);
    assert(gold.length === expectedGold.length && gold.length > 0 && gold.length <= 3 + 3, `q${q}: gold screens = top3 (gold=${gold.length}, expected=${expectedGold.length})`);
    if (ls) {
      const top = ls.leaderboard[0];
      const topPlayer = players.find((p) => p.id === top.playerId);
      assert(topPlayer?.state?.isTopThree === true && topPlayer.state.rank === 1, `q${q}: #1 player has gold + rank 1`);
    }
    const nxt = await emitAck<{}>((ack) => admin.emit('admin:next', { code }, ack));
    assert(nxt.ok, 'admin next -> next question/podium');
  }
  const pod = await waitFor(() => adminState, (s) => s.phase === 'podium', 5000, 'podium');
  assert(pod?.leaderboard.length, 'podium has leaderboard');
  await waitFor(() => players[4].state, (s) => s.phase === 'podium', 3000, 'players see podium');
  await sleep(150);
  const goldFinal = players.filter((p) => p.state?.isTopThree);
  assert(goldFinal.length >= 1 && goldFinal.length <= 6, `podium gold count sane (${goldFinal.length})`);
  console.log('winner:', pod?.leaderboard[0]?.name, pod?.leaderboard[0]?.score, '| gold screens:', goldFinal.map((p) => `${p.name}#${p.state?.rank}`).join(', '));
  const end = await emitAck<{}>((ack) => admin.emit('admin:end', { code }, ack));
  assert(end.ok, 'admin end');
  await waitFor(() => adminState, (s) => s.phase === 'ended', 3000, 'ended');
  assert(displayState?.phase === 'ended', 'display reached ended');
  const del = await emitAck<{}>((ack) => admin.emit('admin:deleteSession', { code }, ack));
  assert(del.ok, 'delete session');

  const avgUpdates = players.reduce((a, p) => a + p.updates, 0) / players.length;
  console.log(`done in ${Date.now() - t0}ms; avg player:state updates per player: ${avgUpdates.toFixed(0)}`);
  players.forEach((p) => p.s.close()); admin.close(); display.close();
  if (failures.length) { console.error(`\n${failures.length} FAILURES`); process.exit(1); }
  console.log('\nALL CHECKS PASSED');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
