import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ChoiceIndex, PlayerState } from '../../../shared/protocol';
import { getSocket } from '../lib/socket';
import { syncClock } from '../lib/clock';
import { LAST_CODE_KEY, forgetSession, getItem, playerKey, removeItem, setItem } from '../components/player/storage';
import Spinner from '../components/player/Spinner';
import PhaseLobby from '../components/player/PhaseLobby';
import PhaseQuestion from '../components/player/PhaseQuestion';
import PhaseAnswers from '../components/player/PhaseAnswers';
import PhaseReveal from '../components/player/PhaseReveal';
import PhaseLeaderboard from '../components/player/PhaseLeaderboard';
import PhasePodium from '../components/player/PhasePodium';
import PhaseEnded from '../components/player/PhaseEnded';
import '../styles/player.css';

export default function PlayPage() {
  const navigate = useNavigate();
  const [code] = useState(() => getItem(LAST_CODE_KEY));

  const [state, setState] = useState<PlayerState | null>(null);
  const [connected, setConnected] = useState(() => getSocket().connected);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [pendingChoice, setPendingChoice] = useState<ChoiceIndex | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // No remembered game: back to the join screen.
  useEffect(() => {
    if (!code) navigate('/', { replace: true });
  }, [code, navigate]);

  // Socket wiring: (re)join on mount and on every reconnect; subscribe to state + kicked.
  useEffect(() => {
    if (!code) return;
    const socket = getSocket();
    let alive = true;

    const join = () => {
      const existingPlayerId = getItem(playerKey(code)) ?? undefined;
      socket.emit('player:join', { code, existingPlayerId }, (res) => {
        if (!alive) return;
        if (!res.ok) {
          setJoinError(res.error || 'Could not rejoin the game.');
          return;
        }
        setItem(playerKey(code), res.playerId);
        setJoinError(null);
        syncClock(res.state.serverNow);
        setState(res.state);
      });
    };

    const onState = (s: PlayerState) => {
      if (!alive) return;
      syncClock(s.serverNow);
      setState(s);
    };
    const onKicked = ({ reason }: { reason: string }) => {
      if (!alive) return;
      forgetSession(code);
      navigate('/', { replace: true, state: { notice: reason || 'You were removed from the game.' } });
    };
    const onConnect = () => {
      if (!alive) return;
      setConnected(true);
      join();
    };
    const onDisconnect = () => {
      if (!alive) return;
      setConnected(false);
    };

    socket.on('player:state', onState);
    socket.on('player:kicked', onKicked);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // If already connected, 'connect' will not fire again, so join now.
    if (socket.connected) join();

    // Phones that lock the screen sometimes keep the socket but miss events: re-sync when visible again.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && socket.connected) join();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      alive = false;
      socket.off('player:state', onState);
      socket.off('player:kicked', onKicked);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [code, navigate]);

  // Reset the optimistic pick whenever the question changes.
  const qIndex = state?.currentIndex ?? -1;
  const phase = state?.phase ?? null;
  useEffect(() => {
    setPendingChoice(null);
  }, [qIndex]);

  // Short-lived toast.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const answering = useRef(false);
  const onPick = useCallback(
    (choice: ChoiceIndex) => {
      if (answering.current) return;
      answering.current = true;
      setPendingChoice(choice);
      getSocket().emit('player:answer', { choice }, (res) => {
        answering.current = false;
        if (!res.ok) {
          setPendingChoice(null);
          setToast(res.error || 'Answer not accepted');
        } else if (!res.accepted) {
          setPendingChoice(null);
          setToast("Too late — time's up!");
        }
      });
    },
    [],
  );

  const onLeave = useCallback(() => {
    removeItem(LAST_CODE_KEY);
    navigate('/', { replace: true });
  }, [navigate]);

  const gold = !!state && state.isTopThree && (phase === 'leaderboard' || phase === 'podium');

  // Paint the document background too, so iOS overscroll / rubber-banding stays gold.
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = gold ? 'var(--gold)' : '';
    return () => {
      document.body.style.background = prev;
    };
  }, [gold]);

  if (!code) return null;

  return (
    <div className={`pl-root ${gold ? 'gold-screen pl-root--gold' : ''}`}>
      {!connected && (
        <div className="pl-banner" role="status" aria-live="polite">
          Reconnecting…
        </div>
      )}
      {toast && <div className="pl-toast" role="status">{toast}</div>}

      <main className="pl-main">
        {joinError ? (
          <section className="pl-center">
            <h1 className="pl-reveal__title">Hmm.</h1>
            <p className="pl-error" role="alert">{joinError}</p>
            <button type="button" className="btn pl-big-btn" onClick={() => { forgetSession(code); navigate('/', { replace: true }); }}>
              Back to join
            </button>
          </section>
        ) : !state ? (
          <section className="pl-center">
            <Spinner label={connected ? 'Joining game…' : 'Connecting…'} />
          </section>
        ) : (
          <>
            <Header state={state} gold={gold} />
            <PhaseView state={state} gold={gold} pendingChoice={pendingChoice} onPick={onPick} onLeave={onLeave} />
            <footer className="pl-foot">
              <span className="pl-foot__name">{state.name}</span>
              <span className="pl-foot__code">Game {state.code}</span>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

function Header({ state, gold }: { state: PlayerState; gold: boolean }) {
  const showQ = state.currentIndex >= 0 && state.phase !== 'lobby' && state.phase !== 'podium' && state.phase !== 'ended';
  return (
    <header className={`pl-header ${gold ? 'pl-header--gold' : ''}`}>
      <span className="pl-header__q">
        {showQ ? `Q ${state.currentIndex + 1} / ${state.totalQuestions}` : 'CBC Quiz'}
      </span>
      <span className="pl-header__score">{state.score.toLocaleString()} pts</span>
    </header>
  );
}

function PhaseView({
  state,
  gold,
  pendingChoice,
  onPick,
  onLeave,
}: {
  state: PlayerState;
  gold: boolean;
  pendingChoice: ChoiceIndex | null;
  onPick: (c: ChoiceIndex) => void;
  onLeave: () => void;
}) {
  switch (state.phase) {
    case 'lobby':
      return <PhaseLobby state={state} />;
    case 'question':
      return <PhaseQuestion state={state} />;
    case 'answers':
      return <PhaseAnswers state={state} pendingChoice={pendingChoice} onPick={onPick} />;
    case 'reveal':
      return <PhaseReveal state={state} />;
    case 'leaderboard':
      return <PhaseLeaderboard state={state} gold={gold} />;
    case 'podium':
      return <PhasePodium state={state} gold={gold} />;
    case 'ended':
      return <PhaseEnded state={state} onLeave={onLeave} />;
    default:
      return (
        <section className="pl-center">
          <Spinner label="Waiting for the host…" />
        </section>
      );
  }
}
