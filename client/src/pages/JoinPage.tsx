import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getSocket } from '../lib/socket';
import { LAST_CODE_KEY, getItem, normalizeCode, playerKey, rememberPlayer } from '../components/player/storage';
import Spinner from '../components/player/Spinner';
import '../styles/player.css';

type Status = { kind: 'idle' } | { kind: 'joining'; code: string } | { kind: 'error'; message: string };

const JOIN_TIMEOUT_MS = 10000;

export default function JoinPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const urlCode = normalizeCode(params.get('code') ?? '');

  const [code, setCode] = useState(urlCode);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const inFlight = useRef(false);
  const autoTried = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Notice passed from PlayPage (kicked / session deleted).
  const notice: string | null = (location.state as { notice?: string } | null)?.notice ?? null;

  // Rejoin affordance for a previous game on this phone.
  const lastCode = getItem(LAST_CODE_KEY);
  const canRejoin = !!lastCode && !!getItem(playerKey(lastCode)) && lastCode !== urlCode;

  const join = useCallback(
    (raw: string) => {
      const c = normalizeCode(raw);
      if (c.length !== 6 || inFlight.current) return;
      inFlight.current = true;
      setStatus({ kind: 'joining', code: c });

      const socket = getSocket();
      const existingPlayerId = getItem(playerKey(c)) ?? undefined;
      socket.timeout(JOIN_TIMEOUT_MS).emit('player:join', { code: c, existingPlayerId }, (err, res) => {
        inFlight.current = false;
        if (err) {
          setStatus({ kind: 'error', message: 'Could not reach the game server. Check your connection and try again.' });
          return;
        }
        if (!res.ok) {
          setStatus({ kind: 'error', message: res.error || 'Could not join that game.' });
          return;
        }
        rememberPlayer(c, res.playerId);
        navigate('/play', { replace: true });
      });
    },
    [navigate],
  );

  // Auto-join from ?code=XXXXXX (QR scan).
  useEffect(() => {
    if (urlCode.length === 6 && !autoTried.current) {
      autoTried.current = true;
      join(urlCode);
    }
  }, [urlCode, join]);

  // Auto-submit once 6 digits are typed.
  useEffect(() => {
    if (code.length === 6 && status.kind === 'idle') join(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(normalizeCode(e.target.value));
    if (status.kind === 'error') setStatus({ kind: 'idle' });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6) join(code);
    else inputRef.current?.focus();
  };

  const joining = status.kind === 'joining';

  return (
    <div className="pl-root pl-join">
      <main className="pl-main pl-join__main">
        <header className="pl-join__brand fade-up">
          <div className="pl-join__logo" aria-hidden="true">✦</div>
          <h1 className="pl-join__title">CBC Quiz</h1>
          <p className="pl-join__subtitle">Claude Builder Club</p>
        </header>

        {notice && status.kind === 'idle' && (
          <div className="pl-notice fade-up" role="status">{notice}</div>
        )}

        {joining ? (
          <div className="pl-join__joining fade-up">
            <Spinner label={`Joining ${status.code}…`} />
          </div>
        ) : (
          <form className="pl-join__form fade-up" onSubmit={onSubmit} noValidate>
            <label className="pl-join__label" htmlFor="game-code">Enter the game code</label>
            <input
              ref={inputRef}
              id="game-code"
              className={`pl-code-input ${status.kind === 'error' ? 'pl-code-input--error' : ''}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={onChange}
              autoFocus={urlCode.length === 0}
              aria-invalid={status.kind === 'error'}
              aria-describedby={status.kind === 'error' ? 'join-error' : undefined}
            />
            {status.kind === 'error' && (
              <div id="join-error" className="pl-error" role="alert">{status.message}</div>
            )}
            <button type="submit" className="btn pl-big-btn" disabled={code.length !== 6}>
              Join
            </button>
          </form>
        )}

        {canRejoin && !joining && (
          <button
            type="button"
            className="btn secondary pl-rejoin fade-up"
            style={{ animationDelay: '.15s' }}
            onClick={() => join(lastCode!)}
          >
            Rejoin game {lastCode}
          </button>
        )}

        <footer className="pl-join__foot">
          Scan the QR on the big screen, or type the code shown there.
        </footer>
      </main>
    </div>
  );
}
