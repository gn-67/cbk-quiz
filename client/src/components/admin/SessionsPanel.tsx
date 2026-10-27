import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminSessionSummary, QuestionSet } from '../../../../shared/protocol';
import { adminCall, errorMessage, onAdminAuthChange } from '../../lib/admin';
import { useToast } from './Toasts';
import { useAdmin } from './AdminContext';
import ConfirmButton from './ConfirmButton';
import { relativeTime } from './questionSetJson';

interface Props {
  sets: QuestionSet[];
  selectedCode: string | null;
  onSelect: (code: string | null) => void;
  /** Bump to force a refresh (e.g. after a game action). */
  refreshSignal: number;
}

const LIVE = new Set(['question', 'answers', 'reveal', 'leaderboard']);

export default function SessionsPanel({ sets, selectedCode, onSelect, refreshSignal }: Props) {
  const toast = useToast();
  const { reportError } = useAdmin();
  const [sessions, setSessions] = useState<AdminSessionSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [setId, setSetId] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const inFlight = useRef(false);

  const sortedSets = [...sets].sort((a, b) => b.updatedAt - a.updatedAt);

  // Keep the dropdown pointing at an existing set.
  useEffect(() => {
    if (!sets.some((s) => s.id === setId)) setSetId(sortedSets[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets]);

  const refresh = useCallback(async (manual = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (manual) setRefreshing(true);
    try {
      const res = await adminCall('admin:listSessions');
      setSessions([...res.sessions].sort((a, b) => b.createdAt - a.createdAt));
      setListError(null);
    } catch (err) {
      setListError(errorMessage(err));
      if (manual) reportError(err, 'Refresh failed');
    } finally {
      inFlight.current = false;
      if (manual) setRefreshing(false);
    }
  }, [reportError]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshSignal]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 5000);
    const off = onAdminAuthChange((ok) => {
      if (ok) void refresh();
    });
    return () => {
      clearInterval(id);
      off();
    };
  }, [refresh]);

  async function create() {
    if (!setId) return;
    setCreating(true);
    try {
      const res = await adminCall('admin:createSession', { questionSetId: setId });
      toast.success(`Session ${res.code} created`);
      onSelect(res.code);
      void refresh();
    } catch (err) {
      reportError(err, 'Create session failed');
    } finally {
      setCreating(false);
    }
  }

  async function remove(code: string) {
    setDeleting(code);
    try {
      await adminCall('admin:deleteSession', { code });
      toast.success(`Session ${code} deleted`);
      if (selectedCode === code) onSelect(null);
      setSessions((list) => list?.filter((s) => s.code !== code) ?? list);
      void refresh();
    } catch (err) {
      reportError(err, 'Delete session failed');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section className="adm-panel" aria-labelledby="adm-sess-h">
      <div className="adm-panel-h">
        <h2 id="adm-sess-h">
          Sessions<span className="adm-count">{sessions?.length ?? 0}</span>
        </h2>
        <button
          type="button"
          className={`btn ghost sm${refreshing ? ' pending' : ''}`}
          onClick={() => refresh(true)}
          disabled={refreshing}
        >
          Refresh
        </button>
      </div>

      <div className="adm-row">
        <select
          className="adm-grow"
          style={{ flex: '1 1 160px', width: 'auto' }}
          value={setId}
          onChange={(e) => setSetId(e.target.value)}
          disabled={sets.length === 0 || creating}
          aria-label="Question set for new session"
        >
          {sets.length === 0 && <option value="">No question sets</option>}
          {sortedSets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.questions.length})
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`btn${creating ? ' pending' : ''}`}
          onClick={create}
          disabled={!setId || creating}
        >
          Create session
        </button>
      </div>

      {listError && <div className="adm-status err">Session list: {listError}</div>}
      {sessions && sessions.length === 0 && <div className="adm-empty">No sessions. Create one above.</div>}
      {!sessions && !listError && <div className="adm-empty">Loading…</div>}

      <div className="adm-list">
        {sessions?.map((s) => {
          const selected = s.code === selectedCode;
          return (
            <div className={`adm-item${selected ? ' selected' : ''}`} key={s.code}>
              <div className="adm-item-main">
                <div className="adm-row">
                  <span className="adm-item-title adm-num" style={{ letterSpacing: '.08em' }}>
                    {s.code}
                  </span>
                  <span className={`adm-badge ${s.phase}${LIVE.has(s.phase) ? ' live' : ''}`}>{s.phase}</span>
                </div>
                <div className="adm-item-sub">
                  {s.questionSetName} · {s.playerCount} player{s.playerCount === 1 ? '' : 's'} · Q{' '}
                  {Math.max(0, s.currentIndex + 1)}/{s.totalQuestions} · {relativeTime(s.createdAt)}
                </div>
              </div>
              <div className="adm-item-actions">
                <button
                  type="button"
                  className={`btn sm ${selected ? 'ghost' : 'secondary'}`}
                  disabled={selected}
                  onClick={() => onSelect(s.code)}
                >
                  {selected ? 'Selected' : 'Select'}
                </button>
                <ConfirmButton
                  label="Delete"
                  question={`Delete ${s.code}?`}
                  confirmLabel="Delete"
                  pending={deleting === s.code}
                  onConfirm={() => remove(s.code)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
