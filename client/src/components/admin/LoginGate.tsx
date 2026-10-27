import { useEffect, useState, type FormEvent } from 'react';
import { clearAdminPassword, ensureAdminSocket, errorMessage, setAdminPassword } from '../../lib/admin';
import { getSocket } from '../../lib/socket';

interface Props {
  initialError?: string | null;
  onSuccess: () => void;
}

export default function LoginGate({ initialError, onSuccess }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(() => getSocket().connected);

  useEffect(() => {
    const s = getSocket();
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    s.on('connect', on);
    s.on('disconnect', off);
    setConnected(s.connected);
    return () => {
      s.off('connect', on);
      s.off('disconnect', off);
    };
  }, []);

  useEffect(() => {
    setError(initialError ?? null);
  }, [initialError]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    setAdminPassword(password);
    try {
      await ensureAdminSocket({ timeoutMs: 8000 });
      onSuccess();
    } catch (err) {
      clearAdminPassword();
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm adm-login">
      <form className="card fade-up" onSubmit={submit}>
        <div className="adm-brand">
          <span className="adm-logo">Q</span>
          <h1>CBK Admin</h1>
        </div>
        <p>Sign in to manage question sets and run live games.</p>
        <label className="adm-field">
          <span>Admin password</span>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={busy}
          />
        </label>
        {error && (
          <div className="adm-status err" role="alert">
            {error}
          </div>
        )}
        <button type="submit" className={`btn${busy ? ' pending' : ''}`} disabled={busy || !password}>
          Sign in
        </button>
        <div className="adm-row between">
          <span className="adm-hint">
            Set <code>ADMIN_PASSWORD</code> on the server; default is <code>cbc-admin</code>
          </span>
          <span className="adm-conn">
            <span className={`adm-dot${connected ? ' on' : ''}`} />
            {connected ? 'Server connected' : 'Connecting…'}
          </span>
        </div>
      </form>
    </div>
  );
}
