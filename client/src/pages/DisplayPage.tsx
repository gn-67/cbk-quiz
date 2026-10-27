import { Component, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { SessionPublicState } from '../../../shared/protocol';
import { getSocket } from '../lib/socket';
import { syncClock } from '../lib/clock';
import FullscreenButton from '../components/display/FullscreenButton';
import HeaderStrip from '../components/display/HeaderStrip';
import LobbyScreen from '../components/display/LobbyScreen';
import QuestionScreen from '../components/display/QuestionScreen';
import AnswersScreen from '../components/display/AnswersScreen';
import RevealScreen from '../components/display/RevealScreen';
import LeaderboardScreen from '../components/display/LeaderboardScreen';
import PodiumScreen from '../components/display/PodiumScreen';
import EndedScreen from '../components/display/EndedScreen';
import '../styles/display.css';

/** Never let a render error blank the projector. */
class ScreenBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="dp-status">
          <div className="dp-spinner" />
          <p>Waiting for the next update…</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="dp">
      {children}
      <FullscreenButton />
    </div>
  );
}

function CodeEntry() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const clean = value.replace(/\D/g, '').slice(0, 6);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (clean.length === 6) navigate(`/display/${clean}`);
  };
  return (
    <Shell>
      <div className="dp-status">
        <div className="brand">CBC Quiz · Display</div>
        <h1>Enter game code</h1>
        <p>Open this page on the projector and enter the 6-digit session code.</p>
        <form className="dp-code-form" onSubmit={submit}>
          <input
            className="dp-code-input"
            inputMode="numeric"
            autoFocus
            placeholder="000000"
            value={clean}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Game code"
          />
          <button className="btn" type="submit" disabled={clean.length !== 6}>
            Show
          </button>
        </form>
      </div>
    </Shell>
  );
}

function Screen({ state }: { state: SessionPublicState }) {
  switch (state.phase) {
    case 'lobby':
      return <LobbyScreen state={state} />;
    case 'question':
      return <QuestionScreen state={state} />;
    case 'answers':
      return <AnswersScreen state={state} />;
    case 'reveal':
      return <RevealScreen state={state} />;
    case 'leaderboard':
      return <LeaderboardScreen state={state} />;
    case 'podium':
      return <PodiumScreen state={state} />;
    case 'ended':
      return <EndedScreen state={state} />;
    default:
      return (
        <div className="dp-status">
          <div className="dp-spinner" />
        </div>
      );
  }
}

function LiveDisplay({ code }: { code: string }) {
  const [state, setState] = useState<SessionPublicState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    let alive = true;
    setState(null);
    setError(null);
    setDeleted(false);

    const subscribe = () => {
      socket.emit('display:subscribe', { code }, (res) => {
        if (!alive) return;
        if (res && res.ok) {
          setError(null);
          if (res.state) {
            syncClock(res.state.serverNow);
            setState(res.state);
          }
        } else {
          setError((res && !res.ok && res.error) || 'Could not open this session');
        }
      });
    };
    const onState = (s: SessionPublicState) => {
      if (!alive || !s || (s.code && s.code !== code)) return;
      syncClock(s.serverNow);
      setState(s);
      setError(null);
    };
    const onDeleted = (p: { code: string }) => {
      if (!alive || (p?.code && p.code !== code)) return;
      setDeleted(true);
    };

    socket.on('connect', subscribe);
    socket.on('session:state', onState);
    socket.on('session:deleted', onDeleted);
    if (socket.connected) subscribe();
    return () => {
      alive = false;
      socket.off('connect', subscribe);
      socket.off('session:state', onState);
      socket.off('session:deleted', onDeleted);
    };
  }, [code]);

  if (deleted) {
    return (
      <Shell>
        <div className="dp-status">
          <div className="brand">CBC Quiz</div>
          <h1>Session closed</h1>
          <p>The host has closed game {code}.</p>
          <Link to="/display">Show another game</Link>
        </div>
      </Shell>
    );
  }
  if (error && !state) {
    return (
      <Shell>
        <div className="dp-status">
          <div className="brand">CBC Quiz</div>
          <h1>Can't show game {code}</h1>
          <p className="dp-error">{error}</p>
          <Link to="/display">Enter a different code</Link>
        </div>
      </Shell>
    );
  }
  if (!state) {
    return (
      <Shell>
        <div className="dp-status">
          <div className="dp-spinner" />
          <h1>Connecting…</h1>
          <p>Game {code}</p>
        </div>
      </Shell>
    );
  }

  const inGame = state.phase !== 'lobby';
  return (
    <Shell>
      {inGame && <HeaderStrip state={state} />}
      <div className="dp-main">
        <ScreenBoundary resetKey={`${state.phase}:${state.currentIndex}:${state.serverNow}`}>
          <Screen state={state} />
        </ScreenBoundary>
      </div>
    </Shell>
  );
}

export default function DisplayPage() {
  const { code } = useParams();
  const clean = (code ?? '').trim();
  if (!clean) return <CodeEntry />;
  return <LiveDisplay key={clean} code={clean} />;
}
