import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../styles/admin.css';
import type { QuestionSet } from '../../../shared/protocol';
import {
  adminFetch,
  clearAdminPassword,
  ensureAdminSocket,
  errorMessage,
  getAdminPassword,
  isAdminAuthed,
  onAdminAuthChange,
} from '../lib/admin';
import { getSocket } from '../lib/socket';
import LoginGate from '../components/admin/LoginGate';
import { ToastProvider, useToast } from '../components/admin/Toasts';
import { AdminContext, isAuthError, type AdminApi } from '../components/admin/AdminContext';
import QuestionSetsPanel from '../components/admin/QuestionSetsPanel';
import SessionsPanel from '../components/admin/SessionsPanel';
import GameControl from '../components/admin/GameControl';

type AuthState = 'checking' | 'login' | 'ready';
const SELECTED_KEY = 'cbc:adminSelectedSession';

export default function AdminPage() {
  const [auth, setAuth] = useState<AuthState>(() => (getAdminPassword() ? 'checking' : 'login'));
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'CBK Admin';
  }, []);

  // Resume a stored password on load.
  useEffect(() => {
    if (auth !== 'checking') return;
    let cancelled = false;
    ensureAdminSocket({ timeoutMs: 8000 })
      .then(() => {
        if (!cancelled) setAuth('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        clearAdminPassword();
        setLoginError(errorMessage(err));
        setAuth('login');
      });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  const signOut = useCallback((reason?: string) => {
    clearAdminPassword();
    setLoginError(reason ?? null);
    setAuth('login');
  }, []);

  if (auth === 'checking') {
    return (
      <div className="adm adm-login">
        <div className="adm-hint">Signing in…</div>
      </div>
    );
  }
  if (auth === 'login') {
    return (
      <LoginGate
        initialError={loginError}
        onSuccess={() => {
          setLoginError(null);
          setAuth('ready');
        }}
      />
    );
  }
  return (
    <ToastProvider>
      <Dashboard signOut={signOut} />
    </ToastProvider>
  );
}

function useConnected(): boolean {
  const [ok, setOk] = useState(() => isAdminAuthed());
  useEffect(() => {
    const s = getSocket();
    const update = () => setOk(isAdminAuthed());
    s.on('connect', update);
    s.on('disconnect', update);
    const off = onAdminAuthChange(update);
    update();
    return () => {
      s.off('connect', update);
      s.off('disconnect', update);
      off();
    };
  }, []);
  return ok;
}

function Dashboard({ signOut }: { signOut: (reason?: string) => void }) {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const connected = useConnected();

  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [setsLoading, setSetsLoading] = useState(true);
  const [setsError, setSetsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SELECTED_KEY);
    } catch {
      return null;
    }
  });
  const [refreshSignal, setRefreshSignal] = useState(0);

  const reportError = useCallback(
    (err: unknown, context?: string) => {
      const msg = errorMessage(err);
      if (isAuthError(msg)) {
        signOut('Session expired or password changed — please sign in again.');
        return;
      }
      toastRef.current.error(context ? `${context}: ${msg}` : msg);
    },
    [signOut],
  );
  const api = useMemo<AdminApi>(() => ({ reportError, signOut }), [reportError, signOut]);

  // Automatic re-auth after reconnect failed because the password is wrong.
  useEffect(
    () =>
      onAdminAuthChange((ok, error) => {
        if (!ok && error && isAuthError(error)) signOut('Admin password rejected — please sign in again.');
      }),
    [signOut],
  );

  const loadSets = useCallback(async () => {
    setSetsLoading(true);
    try {
      const list = await adminFetch<QuestionSet[]>('/api/question-sets');
      setSets(list);
      setSetsError(null);
    } catch (err) {
      const msg = errorMessage(err);
      setSetsError(msg);
      reportError(err, 'Loading question sets failed');
    } finally {
      setSetsLoading(false);
    }
  }, [reportError]);

  useEffect(() => {
    void loadSets();
  }, [loadSets]);

  const select = useCallback((code: string | null) => {
    setSelected(code);
    try {
      if (code) sessionStorage.setItem(SELECTED_KEY, code);
      else sessionStorage.removeItem(SELECTED_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const bump = useCallback(() => setRefreshSignal((n) => n + 1), []);
  const onGone = useCallback(() => {
    select(null);
    bump();
  }, [select, bump]);

  return (
    <AdminContext.Provider value={api}>
      <div className="adm">
        <header className="adm-topbar">
          <div className="adm-brand">
            <span className="adm-logo">Q</span>
            <span>CBK Admin</span>
          </div>
          <span className="adm-conn" title={connected ? 'Connected and signed in' : 'Reconnecting to server…'}>
            <span className={`adm-dot${connected ? ' on' : ''}`} />
            {connected ? 'Live' : 'Reconnecting…'}
          </span>
          <span className="adm-grow" />
          <button type="button" className="btn ghost sm" onClick={() => signOut()}>
            Sign out
          </button>
        </header>

        <main className="adm-main">
          <div className="adm-col">
            <SessionsPanel sets={sets} selectedCode={selected} onSelect={select} refreshSignal={refreshSignal} />
            <QuestionSetsPanel
              sets={sets}
              loading={setsLoading}
              loadError={setsError}
              onReload={() => void loadSets()}
              onSetsChange={setSets}
            />
          </div>
          <div className="adm-col">
            {selected ? (
              <GameControl key={selected} code={selected} sets={sets} onGone={onGone} onChanged={bump} />
            ) : (
              <section className="adm-panel">
                <div className="adm-panel-h">
                  <h2>Game control</h2>
                </div>
                <div className="adm-empty">
                  {sets.length === 0
                    ? 'Create a question set, then create a session to run a game.'
                    : 'Create or select a session to control the game.'}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </AdminContext.Provider>
  );
}
