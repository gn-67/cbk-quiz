import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ANSWER_COLORS,
  type ChoiceIndex,
  type QuestionSet,
  type SessionPublicState,
} from '../../../../shared/protocol';
import { adminCall, ensureAdminSocket, errorMessage, onAdminAuthChange } from '../../lib/admin';
import { getSocket } from '../../lib/socket';
import { syncClock, useCountdown } from '../../lib/clock';
import { useToast } from './Toasts';
import { useAdmin } from './AdminContext';
import ConfirmButton from './ConfirmButton';
import PlayersPanel from './PlayersPanel';
import LeaderboardPanel from './LeaderboardPanel';

interface Props {
  code: string;
  sets: QuestionSet[];
  /** Session no longer exists (deleted here or elsewhere). */
  onGone: () => void;
  /** Something changed that the session list should reflect. */
  onChanged: () => void;
}

type GameEvent = 'admin:start' | 'admin:next' | 'admin:end' | 'admin:deleteSession';

interface PrimaryAction {
  label: string;
  event: GameEvent;
  className: string;
  disabled?: boolean;
  hint?: string;
  keyboard: boolean;
}

const LIVE = new Set(['question', 'answers', 'reveal', 'leaderboard']);
const LETTERS = ['A', 'B', 'C', 'D'];

function primaryFor(s: SessionPublicState): PrimaryAction | null {
  const isLast = s.currentIndex >= s.totalQuestions - 1;
  switch (s.phase) {
    case 'lobby':
      return {
        label: 'Start game',
        event: 'admin:start',
        className: 'btn success lg',
        disabled: s.playerCount === 0,
        hint: s.playerCount === 0 ? 'Waiting for at least one player to join' : undefined,
        keyboard: true,
      };
    case 'question':
    case 'answers':
      return { label: 'Skip to results', event: 'admin:next', className: 'btn lg', keyboard: true };
    case 'reveal':
      return { label: 'Show leaderboard', event: 'admin:next', className: 'btn lg', keyboard: true };
    case 'leaderboard':
      return isLast
        ? { label: 'Show final podium', event: 'admin:next', className: 'btn gold lg', keyboard: true }
        : { label: 'Next question', event: 'admin:next', className: 'btn lg', keyboard: true };
    case 'podium':
      return { label: 'End session', event: 'admin:end', className: 'btn secondary lg', keyboard: true };
    case 'ended':
      return { label: 'Delete session', event: 'admin:deleteSession', className: 'btn danger lg', keyboard: false };
    default:
      return null;
  }
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export default function GameControl({ code, sets, onGone, onChanged }: Props) {
  const toast = useToast();
  const { reportError } = useAdmin();
  const [state, setState] = useState<SessionPublicState | null>(null);
  const [subError, setSubError] = useState<string | null>(null);
  const [pending, setPending] = useState<GameEvent | null>(null);
  const onGoneRef = useRef(onGone);
  onGoneRef.current = onGone;
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  const lastPhase = useRef<string | null>(null);

  // ---- subscription ----
  const subscribe = useCallback(async () => {
    try {
      await ensureAdminSocket({ timeoutMs: 8000 });
      const res = await adminCall('admin:subscribe', { code });
      syncClock(res.state.serverNow);
      setState(res.state);
      setSubError(null);
    } catch (err) {
      const msg = errorMessage(err);
      if (/not found|no such session|does not exist/i.test(msg)) {
        toast.error(`Session ${code} no longer exists`);
        onGoneRef.current();
        return;
      }
      setSubError(msg);
    }
  }, [code, toast]);

  useEffect(() => {
    setState(null);
    setSubError(null);
    lastPhase.current = null;
    const socket = getSocket();
    const onState = (s: SessionPublicState) => {
      if (s.code !== code) return;
      syncClock(s.serverNow);
      setState(s);
    };
    const onDeleted = (p: { code: string }) => {
      if (p.code !== code) return;
      toast.push(`Session ${code} was deleted`);
      onGoneRef.current();
    };
    socket.on('session:state', onState);
    socket.on('session:deleted', onDeleted);
    void subscribe();
    const off = onAdminAuthChange((ok) => {
      if (ok) void subscribe(); // re-subscribe after reconnect + re-auth
    });
    return () => {
      socket.off('session:state', onState);
      socket.off('session:deleted', onDeleted);
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Tell the session list when the phase changes.
  useEffect(() => {
    if (!state) return;
    if (lastPhase.current !== null && lastPhase.current !== state.phase) onChangedRef.current();
    lastPhase.current = state.phase;
  }, [state]);

  // ---- actions ----
  const run = useCallback(
    async (event: GameEvent) => {
      if (pending) return;
      setPending(event);
      try {
        await adminCall(event, { code });
        if (event === 'admin:start') toast.success('Game started');
        else if (event === 'admin:end') toast.success('Session ended');
        else if (event === 'admin:deleteSession') {
          toast.success(`Session ${code} deleted`);
          onGoneRef.current();
        }
        onChangedRef.current();
      } catch (err) {
        reportError(err, 'Action failed');
      } finally {
        setPending(null);
      }
    },
    [code, pending, reportError, toast],
  );

  const primary = state ? primaryFor(state) : null;
  const primaryRef = useRef<{ primary: PrimaryAction | null; run: typeof run }>({ primary, run });
  primaryRef.current = { primary, run };

  // ---- keyboard: Space / ArrowRight ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'ArrowRight') return;
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (isTypingTarget(e.target)) return;
      if (document.querySelector('.adm-modal')) return; // editor open
      // Space on a focused button already clicks it; don't double-fire.
      if (e.key === ' ' && e.target instanceof HTMLElement && e.target.closest('button, a, summary')) return;
      const { primary: p, run: r } = primaryRef.current;
      if (!p || !p.keyboard || p.disabled) return;
      e.preventDefault();
      void r(p.event);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const remainingMs = useCountdown(state?.phaseEndsAt ?? null);

  // ---- question preview data ----
  const preview = useMemo(() => {
    if (!state) return null;
    const candidates = sets.filter((s) => s.name === state.questionSetName);
    const set = candidates.find((s) => s.questions.length === state.totalQuestions) ?? candidates[0];
    const idx = state.phase === 'lobby' ? 0 : state.currentIndex;
    const setQ = set?.questions[idx];
    const q = state.question;
    if (!q && !setQ) return null;
    if (!q && state.phase !== 'lobby') return null; // podium / ended
    const text = q?.text ?? setQ!.text;
    const choices = q?.choices ?? setQ!.choices;
    const timeLimitSec = q?.timeLimitSec ?? setQ!.timeLimitSec;
    let correct: ChoiceIndex | undefined = q?.correctIndex ?? state.reveal?.correctIndex;
    let keyNote: string | null = null;
    if (correct === undefined) {
      if (setQ && setQ.text.trim() === text.trim()) correct = setQ.correctIndex;
      else keyNote = 'Answer key unavailable (question set was edited or removed)';
    }
    return { idx, text, choices, timeLimitSec, correct, keyNote, upcoming: state.phase === 'lobby' };
  }, [state, sets]);

  async function copyJoin() {
    if (!state) return;
    try {
      await navigator.clipboard.writeText(state.joinUrl);
      toast.success('Join link copied');
    } catch {
      toast.push(`Join link: ${state.joinUrl}`);
    }
  }

  if (!state) {
    return (
      <section className="adm-panel">
        <div className="adm-panel-h">
          <h2>Session {code}</h2>
        </div>
        {subError ? (
          <>
            <div className="adm-status err" role="alert">
              Couldn't load session: {subError}
            </div>
            <div className="adm-row">
              <button type="button" className="btn secondary sm" onClick={() => void subscribe()}>
                Retry
              </button>
              <button type="button" className="btn ghost sm" onClick={onGone}>
                Deselect
              </button>
            </div>
          </>
        ) : (
          <div className="adm-empty">Loading session…</div>
        )}
      </section>
    );
  }

  const live = LIVE.has(state.phase);
  const timed = state.phase === 'question' || state.phase === 'answers';
  const secs = Math.ceil(remainingMs / 1000);
  const answeredOf = Math.max(state.connectedCount, state.answeredCount);
  const answeredPct = answeredOf ? Math.min(100, (state.answeredCount / answeredOf) * 100) : 0;
  const totalAnswered = state.reveal?.totalAnswered ?? 0;

  return (
    <section className="adm-panel" aria-label={`Game control for session ${code}`}>
      <div className="adm-game-head">
        <div>
          <div className="adm-code-label">Game code</div>
          <div className="adm-code">{state.code}</div>
        </div>
        <div className="adm-game-meta">
          <span className={`adm-badge ${state.phase}${live ? ' live' : ''}`}>{state.phase}</span>
          <span className="adm-setname">{state.questionSetName}</span>
          <span className="adm-qmeta adm-num">
            {state.currentIndex >= 0
              ? `Question ${state.currentIndex + 1} of ${state.totalQuestions}`
              : `${state.totalQuestions} questions`}
          </span>
        </div>
        <div className="adm-game-links">
          <a className="btn secondary sm" href={`/display/${state.code}`} target="_blank" rel="noopener noreferrer">
            Open display ↗
          </a>
          <button type="button" className="btn ghost sm" onClick={copyJoin} title={state.joinUrl}>
            Copy join link
          </button>
        </div>
      </div>

      <div className="adm-action-bar">
        <div className="adm-primary">
          {primary && (
            <button
              type="button"
              className={`${primary.className}${pending === primary.event ? ' pending' : ''}`}
              disabled={!!primary.disabled || pending !== null}
              onClick={() => void run(primary.event)}
            >
              {primary.label}
            </button>
          )}
        </div>
        {timed && (
          <div className={`adm-timer${state.phase === 'answers' && secs <= 5 ? ' low' : ''}`} aria-live="off">
            {secs}
            <small>{state.phase === 'question' ? 'preview' : 'seconds'}</small>
          </div>
        )}
        {(state.phase === 'answers' || state.phase === 'question') && (
          <div className="adm-answered adm-num" style={{ minWidth: 110 }}>
            <small>Answered</small>
            {state.answeredCount} / {answeredOf}
            <div className="adm-progress" style={{ marginTop: 4 }}>
              <div style={{ width: `${answeredPct}%` }} />
            </div>
          </div>
        )}
        {state.phase === 'lobby' && (
          <div className="adm-answered adm-num">
            <small>Players</small>
            {state.connectedCount} connected
          </div>
        )}
        {live && (
          <ConfirmButton
            label="End game"
            question="End now and go to podium?"
            confirmLabel="End game"
            className="btn ghost sm"
            confirmClassName="btn danger sm"
            pending={pending === 'admin:end'}
            disabled={pending !== null}
            onConfirm={() => run('admin:end')}
          />
        )}
      </div>
      <div className="adm-row between">
        <span className="adm-hint">
          {primary?.hint ??
            (primary?.keyboard ? (
              <>
                Press <span className="adm-kbd">Space</span> or <span className="adm-kbd">→</span> to{' '}
                {primary.label.toLowerCase()}
              </>
            ) : null)}
        </span>
        {state.phase === 'ended' && <span className="adm-hint">This session is over.</span>}
      </div>

      <div className="adm-game-grid">
        {preview && (
          <section className="adm-panel adm-span-2" aria-label="Question preview">
            <div className="adm-panel-h">
              <h2>{preview.upcoming ? 'Up next' : 'Current question'}</h2>
              <span className="adm-qmeta adm-num">
                Q{preview.idx + 1}/{state.totalQuestions} · {preview.timeLimitSec}s
                {state.reveal ? ` · ${totalAnswered} answered` : ''}
              </span>
            </div>
            <div className="adm-qtext">{preview.text}</div>
            <div className="adm-choices">
              {preview.choices.map((c, j) => {
                const isCorrect = preview.correct === j;
                const count = state.reveal?.counts[j];
                const pct = state.reveal && totalAnswered ? (count! / totalAnswered) * 100 : 0;
                return (
                  <div className={`adm-choice${isCorrect ? ' correct' : ''}`} key={j}>
                    <span className="adm-swatch" style={{ background: ANSWER_COLORS[j] }} aria-hidden />
                    <span className="adm-choice-text">
                      <span className="adm-muted">{LETTERS[j]}.</span> {c}
                    </span>
                    {isCorrect && (
                      <span className="adm-check" aria-label="Correct answer">
                        ✓
                      </span>
                    )}
                    {count !== undefined && <span className="adm-choice-count">{count}</span>}
                    {state.reveal && (
                      <span className="adm-choice-bar" style={{ width: `${pct}%`, background: ANSWER_COLORS[j] }} />
                    )}
                  </div>
                );
              })}
            </div>
            {preview.keyNote && <div className="adm-status">{preview.keyNote}</div>}
          </section>
        )}
        <PlayersPanel
          code={state.code}
          players={state.players}
          connectedCount={state.connectedCount}
          canKick={state.phase !== 'ended'}
        />
        <LeaderboardPanel entries={state.leaderboard} phase={state.phase} />
      </div>
    </section>
  );
}
