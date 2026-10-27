import { useEffect, useMemo, useState } from 'react';
import { ANSWER_COLORS, type ChoiceIndex, type QuestionSet } from '../../../../shared/protocol';
import { adminFetch, errorMessage } from '../../lib/admin';
import { useToast } from './Toasts';
import { useAdmin } from './AdminContext';
import ConfirmButton from './ConfirmButton';
import {
  MAX_CHOICE_LEN,
  MAX_NAME_LEN,
  MAX_QUESTIONS,
  MAX_TEXT_LEN,
  MAX_TIME,
  MIN_TIME,
  draftErrors,
  draftFromInput,
  draftFromSet,
  draftToInput,
  emptyQuestion,
  parseImport,
  questionErrors,
  slugify,
  type Draft,
  type DraftQuestion,
} from './questionSetJson';

interface Props {
  /** Existing set to edit; null = new set. */
  set: QuestionSet | null;
  onClose: () => void;
  onSaved: (set: QuestionSet) => void;
}

const LETTERS = ['A', 'B', 'C', 'D'];

export default function QuestionSetEditor({ set, onClose, onSaved }: Props) {
  const toast = useToast();
  const { reportError } = useAdmin();
  const [draft, setDraft] = useState<Draft>(() => draftFromSet(set));
  const [tab, setTab] = useState<'edit' | 'json'>('edit');
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [importText, setImportText] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const errors = useMemo(() => draftErrors(draft), [draft]);
  const exportJson = useMemo(() => JSON.stringify(draftToInput(draft, false), null, 2), [draft]);

  // Esc closes when nothing would be lost.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !dirty && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, saving, onClose]);

  function update(fn: (d: Draft) => Draft) {
    setDraft(fn);
    setDirty(true);
  }
  function updateQ(key: number, patch: Partial<DraftQuestion>) {
    update((d) => ({ ...d, questions: d.questions.map((q) => (q.key === key ? { ...q, ...patch } : q)) }));
  }
  function setChoice(key: number, j: number, value: string) {
    update((d) => ({
      ...d,
      questions: d.questions.map((q) => {
        if (q.key !== key) return q;
        const choices = [...q.choices] as DraftQuestion['choices'];
        choices[j] = value;
        return { ...q, choices };
      }),
    }));
  }
  function move(i: number, dir: -1 | 1) {
    update((d) => {
      const qs = [...d.questions];
      const j = i + dir;
      if (j < 0 || j >= qs.length) return d;
      [qs[i], qs[j]] = [qs[j]!, qs[i]!];
      return { ...d, questions: qs };
    });
  }
  function remove(key: number) {
    update((d) => ({ ...d, questions: d.questions.filter((q) => q.key !== key) }));
  }
  function add() {
    if (draft.questions.length >= MAX_QUESTIONS) {
      toast.error(`At most ${MAX_QUESTIONS} questions per set`);
      return;
    }
    update((d) => ({ ...d, questions: [...d.questions, emptyQuestion()] }));
    setTimeout(() => {
      const els = document.querySelectorAll<HTMLTextAreaElement>('.adm-qcard textarea');
      els[els.length - 1]?.focus();
    }, 30);
  }

  async function save() {
    if (errors.length) {
      setShowErrors(true);
      setTab('edit');
      toast.error(`Fix ${errors.length} problem${errors.length === 1 ? '' : 's'} before saving`);
      return;
    }
    setSaving(true);
    try {
      const body = JSON.stringify(draftToInput(draft));
      const saved = set
        ? await adminFetch<QuestionSet>(`/api/question-sets/${encodeURIComponent(set.id)}`, { method: 'PUT', body })
        : await adminFetch<QuestionSet>('/api/question-sets', { method: 'POST', body });
      toast.success(`Saved "${saved.name}" (${saved.questions.length} questions)`);
      setDirty(false);
      onSaved(saved);
    } catch (err) {
      reportError(err, 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function doImport(mode: 'replace' | 'append') {
    const res = parseImport(importText);
    if (!res.ok) {
      setImportErrors(res.errors);
      return;
    }
    const imported = draftFromInput(res.input, false);
    if (mode === 'append' && draft.questions.length + imported.questions.length > MAX_QUESTIONS) {
      setImportErrors([`That would exceed ${MAX_QUESTIONS} questions`]);
      return;
    }
    setImportErrors([]);
    update((d) =>
      mode === 'replace'
        ? { name: imported.name || d.name, questions: imported.questions }
        : { ...d, questions: [...d.questions, ...imported.questions] },
    );
    const problems = draftErrors(
      mode === 'replace' ? { name: imported.name || draft.name, questions: imported.questions } : draft,
    ).length;
    toast.success(
      `Imported ${imported.questions.length} question${imported.questions.length === 1 ? '' : 's'}` +
        (problems ? ` — ${problems} field${problems === 1 ? '' : 's'} need fixing` : ''),
    );
    if (problems) setShowErrors(true);
    setImportText('');
    setTab('edit');
  }

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportJson);
      toast.success('JSON copied to clipboard');
    } catch {
      const ta = document.getElementById('adm-export-json') as HTMLTextAreaElement | null;
      ta?.select();
      toast.error('Clipboard blocked — JSON selected, press Ctrl/Cmd+C');
    }
  }
  function downloadExport() {
    const blob = new Blob([exportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugify(draft.name)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('Download started');
  }

  return (
    <div className="adm-modal-backdrop" role="dialog" aria-modal="true" aria-label="Question set editor">
      <div className="adm-modal fade-up">
        <div className="adm-modal-h">
          <h2>{set ? 'Edit question set' : 'New question set'}</h2>
          <div className="adm-tabs">
            <button type="button" className={tab === 'edit' ? 'active' : ''} onClick={() => setTab('edit')}>
              Questions ({draft.questions.length})
            </button>
            <button type="button" className={tab === 'json' ? 'active' : ''} onClick={() => setTab('json')}>
              Import / Export JSON
            </button>
          </div>
        </div>

        <label className="adm-field">
          <span>Set name</span>
          <input
            type="text"
            value={draft.name}
            maxLength={MAX_NAME_LEN + 20}
            placeholder="e.g. Friday trivia"
            className={showErrors && !draft.name.trim() ? 'invalid' : ''}
            onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
            autoFocus={!set}
          />
        </label>

        {tab === 'edit' && (
          <>
            {draft.questions.length === 0 && <div className="adm-empty">No questions yet — add one below.</div>}
            {draft.questions.map((q, i) => (
              <QuestionCard
                key={q.key}
                q={q}
                index={i}
                count={draft.questions.length}
                showErrors={showErrors}
                onPatch={(p) => updateQ(q.key, p)}
                onChoice={(j, v) => setChoice(q.key, j, v)}
                onMove={(dir) => move(i, dir)}
                onRemove={() => remove(q.key)}
              />
            ))}
            <div>
              <button type="button" className="btn secondary" onClick={add} disabled={saving}>
                + Add question
              </button>
            </div>
          </>
        )}

        {tab === 'json' && (
          <>
            <label className="adm-field">
              <span>Import JSON</span>
              <textarea
                className={`adm-mono${importErrors.length ? ' invalid' : ''}`}
                value={importText}
                spellCheck={false}
                placeholder={'{\n  "name": "My quiz",\n  "questions": [\n    { "text": "2 + 2 = ?", "choices": ["3", "4", "5", "22"], "correctIndex": 1, "timeLimitSec": 20 }\n  ]\n}'}
                onChange={(e) => {
                  setImportText(e.target.value);
                  if (importErrors.length) setImportErrors([]);
                }}
              />
            </label>
            {importErrors.length > 0 && (
              <div className="adm-errors" role="alert">
                Can't import:
                <ul>
                  {importErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="adm-row">
              <ConfirmButton
                label="Replace all questions"
                question="Replace current questions?"
                confirmLabel="Replace"
                className="btn sm"
                disabled={!importText.trim()}
                onConfirm={() => doImport('replace')}
              />
              <button
                type="button"
                className="btn secondary sm"
                disabled={!importText.trim()}
                onClick={() => doImport('append')}
              >
                Append questions
              </button>
              <span className="adm-hint">
                Shape: <code>{'{ name, questions: [{ text, choices[4], correctIndex 0–3, timeLimitSec? }] }'}</code>
              </span>
            </div>

            <details className="adm-details" open>
              <summary>Export current set</summary>
              <div className="adm-row" style={{ margin: '10px 0' }}>
                <button type="button" className="btn secondary sm" onClick={copyExport}>
                  Copy JSON
                </button>
                <button type="button" className="btn secondary sm" onClick={downloadExport}>
                  Download .json
                </button>
                {errors.length > 0 && (
                  <span className="adm-status err">Current set has {errors.length} validation problem(s)</span>
                )}
              </div>
              <textarea id="adm-export-json" className="adm-mono" readOnly value={exportJson} spellCheck={false} />
            </details>
          </>
        )}

        {showErrors && errors.length > 0 && (
          <div className="adm-errors" role="alert">
            {errors.length} problem{errors.length === 1 ? '' : 's'} to fix:
            <ul>
              {errors.slice(0, 8).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {errors.length > 8 && <li>…and {errors.length - 8} more</li>}
            </ul>
          </div>
        )}

        <div className="adm-modal-foot">
          {dirty && <span className="adm-status adm-grow">Unsaved changes</span>}
          {dirty ? (
            <ConfirmButton
              label="Cancel"
              question="Discard changes?"
              confirmLabel="Discard"
              className="btn ghost"
              confirmClassName="btn danger sm"
              disabled={saving}
              onConfirm={onClose}
            />
          ) : (
            <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>
              Close
            </button>
          )}
          <button type="button" className={`btn success${saving ? ' pending' : ''}`} disabled={saving} onClick={save}>
            {set ? 'Save changes' : 'Create set'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CardProps {
  q: DraftQuestion;
  index: number;
  count: number;
  showErrors: boolean;
  onPatch: (p: Partial<DraftQuestion>) => void;
  onChoice: (j: number, v: string) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}

function QuestionCard({ q, index, count, showErrors, onPatch, onChoice, onMove, onRemove }: CardProps) {
  const errs = showErrors ? questionErrors(q, index) : [];
  const t = Number(q.timeLimitSec);
  const badTime = showErrors && (!Number.isFinite(t) || t < MIN_TIME || t > MAX_TIME || !q.timeLimitSec.trim());
  return (
    <div className={`adm-qcard${errs.length ? ' invalid' : ''}`}>
      <div className="adm-qcard-h">
        <span className="adm-qnum">Q{index + 1}</span>
        <div className="adm-qcard-tools">
          <button type="button" className="btn ghost icon sm" title="Move up" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button type="button" className="btn ghost icon sm" title="Move down" aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(1)}>
            ↓
          </button>
          <ConfirmButton label="Delete" question="Delete question?" confirmLabel="Delete" onConfirm={onRemove} />
        </div>
      </div>
      <textarea
        value={q.text}
        rows={2}
        maxLength={MAX_TEXT_LEN + 50}
        placeholder="Question text"
        aria-label={`Question ${index + 1} text`}
        className={showErrors && !q.text.trim() ? 'invalid' : ''}
        onChange={(e) => onPatch({ text: e.target.value })}
      />
      <div className="adm-choices-edit">
        {q.choices.map((c, j) => {
          const chosen = q.correctIndex === j;
          return (
            <div className="adm-choice-edit" key={j}>
              <span className="adm-swatch" style={{ background: ANSWER_COLORS[j] }} aria-hidden />
              <input
                type="text"
                value={c}
                maxLength={MAX_CHOICE_LEN + 20}
                placeholder={`Choice ${LETTERS[j]}`}
                aria-label={`Question ${index + 1} choice ${LETTERS[j]}`}
                className={showErrors && !c.trim() ? 'invalid' : ''}
                style={{ borderLeft: `4px solid ${ANSWER_COLORS[j]}` }}
                onChange={(e) => onChoice(j, e.target.value)}
              />
              <label className={chosen ? 'chosen' : ''} title="Mark as correct answer">
                <input
                  type="radio"
                  name={`correct-${q.key}`}
                  checked={chosen}
                  onChange={() => onPatch({ correctIndex: j as ChoiceIndex })}
                />
                {chosen ? 'Correct' : 'Correct?'}
              </label>
            </div>
          );
        })}
      </div>
      <div className="adm-qcard-foot">
        <label className="adm-field">
          <span>Time limit (s)</span>
          <input
            type="number"
            min={MIN_TIME}
            max={MAX_TIME}
            step={1}
            value={q.timeLimitSec}
            className={badTime ? 'invalid' : ''}
            onChange={(e) => onPatch({ timeLimitSec: e.target.value })}
          />
        </label>
        <span className="adm-hint">{MIN_TIME}–{MAX_TIME} seconds</span>
      </div>
      {errs.length > 0 && <div className="adm-status err">{errs.join(' · ')}</div>}
    </div>
  );
}
