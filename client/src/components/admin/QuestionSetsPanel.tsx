import { useState } from 'react';
import type { QuestionSet } from '../../../../shared/protocol';
import { adminFetch } from '../../lib/admin';
import { useToast } from './Toasts';
import { useAdmin } from './AdminContext';
import ConfirmButton from './ConfirmButton';
import QuestionSetEditor from './QuestionSetEditor';
import { relativeTime } from './questionSetJson';

interface Props {
  sets: QuestionSet[];
  loading: boolean;
  loadError: string | null;
  onReload: () => void;
  onSetsChange: (fn: (sets: QuestionSet[]) => QuestionSet[]) => void;
}

export default function QuestionSetsPanel({ sets, loading, loadError, onReload, onSetsChange }: Props) {
  const toast = useToast();
  const { reportError } = useAdmin();
  const [editing, setEditing] = useState<QuestionSet | null | undefined>(undefined); // undefined = closed, null = new
  const [pending, setPending] = useState<string | null>(null); // "dup:<id>" | "del:<id>"

  const sorted = [...sets].sort((a, b) => b.updatedAt - a.updatedAt);

  async function duplicate(set: QuestionSet) {
    setPending(`dup:${set.id}`);
    try {
      const copy = await adminFetch<QuestionSet>('/api/question-sets', {
        method: 'POST',
        body: JSON.stringify({
          name: `${set.name} (copy)`.slice(0, 100),
          questions: set.questions.map(({ id: _id, ...q }) => q),
        }),
      });
      onSetsChange((list) => [...list, copy]);
      toast.success(`Duplicated as "${copy.name}"`);
    } catch (err) {
      reportError(err, 'Duplicate failed');
    } finally {
      setPending(null);
    }
  }

  async function remove(set: QuestionSet) {
    setPending(`del:${set.id}`);
    try {
      await adminFetch(`/api/question-sets/${encodeURIComponent(set.id)}`, { method: 'DELETE' });
      onSetsChange((list) => list.filter((s) => s.id !== set.id));
      toast.success(`Deleted "${set.name}"`);
    } catch (err) {
      reportError(err, 'Delete failed');
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="adm-panel" aria-labelledby="adm-qs-h">
      <div className="adm-panel-h">
        <h2 id="adm-qs-h">
          Question sets<span className="adm-count">{sets.length}</span>
        </h2>
        <div className="adm-row">
          <button
            type="button"
            className={`btn ghost sm${loading ? ' pending' : ''}`}
            onClick={onReload}
            disabled={loading}
            title="Reload question sets"
          >
            Refresh
          </button>
          <button type="button" className="btn sm" onClick={() => setEditing(null)}>
            + New
          </button>
        </div>
      </div>

      {loadError && (
        <div className="adm-status err" role="alert">
          Couldn't load question sets: {loadError}
        </div>
      )}
      {!loading && !loadError && sets.length === 0 && (
        <div className="adm-empty">No question sets yet. Create one to start a game.</div>
      )}
      {loading && sets.length === 0 && <div className="adm-empty">Loading…</div>}

      <div className="adm-list">
        {sorted.map((set) => (
          <div className="adm-item" key={set.id}>
            <div className="adm-item-main">
              <div className="adm-item-title" title={set.name}>
                {set.name}
              </div>
              <div className="adm-item-sub">
                {set.questions.length} question{set.questions.length === 1 ? '' : 's'} · updated{' '}
                <span title={new Date(set.updatedAt).toLocaleString()}>{relativeTime(set.updatedAt)}</span>
              </div>
            </div>
            <div className="adm-item-actions">
              <button type="button" className="btn secondary sm" onClick={() => setEditing(set)} disabled={pending !== null}>
                Edit
              </button>
              <button
                type="button"
                className={`btn ghost sm${pending === `dup:${set.id}` ? ' pending' : ''}`}
                onClick={() => duplicate(set)}
                disabled={pending !== null}
              >
                Duplicate
              </button>
              <ConfirmButton
                label="Delete"
                question={`Delete "${set.name.length > 18 ? set.name.slice(0, 18) + '…' : set.name}"?`}
                confirmLabel="Delete"
                pending={pending === `del:${set.id}`}
                disabled={pending !== null && pending !== `del:${set.id}`}
                onConfirm={() => remove(set)}
              />
            </div>
          </div>
        ))}
      </div>

      {editing !== undefined && (
        <QuestionSetEditor
          set={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(saved) => {
            onSetsChange((list) =>
              list.some((s) => s.id === saved.id) ? list.map((s) => (s.id === saved.id ? saved : s)) : [...list, saved],
            );
            setEditing(undefined);
          }}
        />
      )}
    </section>
  );
}
