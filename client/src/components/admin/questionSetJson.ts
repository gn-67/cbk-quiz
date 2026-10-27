/** Pure helpers for editing / importing / exporting question sets in the admin UI. */
import {
  CHOICE_COUNT,
  DEFAULT_TIME_LIMIT_SEC,
  type ChoiceIndex,
  type QuestionSet,
  type QuestionSetInput,
} from '../../../../shared/protocol';

// Mirrors server/src/questionSets.ts limits.
export const MIN_TIME = 5;
export const MAX_TIME = 120;
export const MAX_QUESTIONS = 100;
export const MAX_NAME_LEN = 100;
export const MAX_TEXT_LEN = 500;
export const MAX_CHOICE_LEN = 200;

export interface DraftQuestion {
  key: number; // stable React key
  id?: string;
  text: string;
  choices: [string, string, string, string];
  correctIndex: ChoiceIndex;
  timeLimitSec: string; // kept as string while typing
}

export interface Draft {
  name: string;
  questions: DraftQuestion[];
}

let keySeq = 1;
export const nextKey = () => keySeq++;

export function emptyQuestion(): DraftQuestion {
  return {
    key: nextKey(),
    text: '',
    choices: ['', '', '', ''],
    correctIndex: 0,
    timeLimitSec: String(DEFAULT_TIME_LIMIT_SEC),
  };
}

export function draftFromInput(input: QuestionSetInput, keepIds = true): Draft {
  return {
    name: input.name,
    questions: input.questions.map((q) => ({
      key: nextKey(),
      id: keepIds ? q.id : undefined,
      text: q.text,
      choices: [...q.choices] as [string, string, string, string],
      correctIndex: q.correctIndex,
      timeLimitSec: String(q.timeLimitSec ?? DEFAULT_TIME_LIMIT_SEC),
    })),
  };
}

export function draftFromSet(set: QuestionSet | null): Draft {
  if (!set) return { name: '', questions: [emptyQuestion()] };
  return draftFromInput(set);
}

export function draftToInput(draft: Draft, includeIds = true): QuestionSetInput {
  return {
    name: draft.name.trim(),
    questions: draft.questions.map((q) => {
      const t = Number(q.timeLimitSec);
      return {
        ...(includeIds && q.id ? { id: q.id } : {}),
        text: q.text.trim(),
        choices: q.choices.map((c) => c.trim()) as [string, string, string, string],
        correctIndex: q.correctIndex,
        timeLimitSec: Number.isFinite(t) ? Math.round(t) : DEFAULT_TIME_LIMIT_SEC,
      };
    }),
  };
}

export function questionErrors(q: DraftQuestion, i: number): string[] {
  const label = `Question ${i + 1}`;
  const errs: string[] = [];
  const text = q.text.trim();
  if (!text) errs.push(`${label}: text is empty`);
  else if (text.length > MAX_TEXT_LEN) errs.push(`${label}: text is over ${MAX_TEXT_LEN} characters`);
  q.choices.forEach((c, j) => {
    const s = c.trim();
    if (!s) errs.push(`${label}: choice ${j + 1} is empty`);
    else if (s.length > MAX_CHOICE_LEN) errs.push(`${label}: choice ${j + 1} is over ${MAX_CHOICE_LEN} characters`);
  });
  const t = Number(q.timeLimitSec);
  if (q.timeLimitSec.trim() === '' || !Number.isFinite(t) || t < MIN_TIME || t > MAX_TIME) {
    errs.push(`${label}: time limit must be ${MIN_TIME}–${MAX_TIME} seconds`);
  }
  return errs;
}

export function draftErrors(draft: Draft): string[] {
  const errs: string[] = [];
  const name = draft.name.trim();
  if (!name) errs.push('Set name is empty');
  else if (name.length > MAX_NAME_LEN) errs.push(`Set name is over ${MAX_NAME_LEN} characters`);
  if (draft.questions.length === 0) errs.push('Add at least one question');
  if (draft.questions.length > MAX_QUESTIONS) errs.push(`At most ${MAX_QUESTIONS} questions per set`);
  draft.questions.forEach((q, i) => errs.push(...questionErrors(q, i)));
  return errs;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Parse JSON text in QuestionSetInput shape (or a bare array of questions).
 * Returns structural errors; content errors (empty text etc.) are reported by draftErrors after import.
 */
export function parseImport(
  text: string,
): { ok: true; input: QuestionSetInput } | { ok: false; errors: string[] } {
  if (!text.trim()) return { ok: false, errors: ['Paste some JSON first'] };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }
  let name = '';
  let rawQuestions: unknown;
  if (Array.isArray(data)) {
    rawQuestions = data;
  } else if (isRecord(data)) {
    if (data.name !== undefined && typeof data.name !== 'string') return { ok: false, errors: ['"name" must be a string'] };
    name = typeof data.name === 'string' ? data.name : '';
    rawQuestions = data.questions;
  } else {
    return { ok: false, errors: ['Expected an object like { "name": "...", "questions": [...] }'] };
  }
  if (!Array.isArray(rawQuestions)) return { ok: false, errors: ['"questions" must be an array'] };
  if (rawQuestions.length === 0) return { ok: false, errors: ['"questions" is empty'] };

  const errors: string[] = [];
  const questions: QuestionSetInput['questions'] = [];
  rawQuestions.forEach((raw, i) => {
    const label = `Question ${i + 1}`;
    if (!isRecord(raw)) {
      errors.push(`${label}: must be an object`);
      return;
    }
    if (typeof raw.text !== 'string') errors.push(`${label}: "text" must be a string`);
    if (
      !Array.isArray(raw.choices) ||
      raw.choices.length !== CHOICE_COUNT ||
      raw.choices.some((c) => typeof c !== 'string')
    ) {
      errors.push(`${label}: "choices" must be an array of ${CHOICE_COUNT} strings`);
    }
    const ci = raw.correctIndex;
    if (typeof ci !== 'number' || !Number.isInteger(ci) || ci < 0 || ci >= CHOICE_COUNT) {
      errors.push(`${label}: "correctIndex" must be 0, 1, 2 or 3`);
    }
    const t = raw.timeLimitSec;
    if (t !== undefined && t !== null && (typeof t !== 'number' || !Number.isFinite(t))) {
      errors.push(`${label}: "timeLimitSec" must be a number`);
    }
    if (errors.length) return;
    questions.push({
      id: typeof raw.id === 'string' ? raw.id : undefined,
      text: raw.text as string,
      choices: raw.choices as [string, string, string, string],
      correctIndex: ci as ChoiceIndex,
      timeLimitSec: typeof t === 'number' ? t : undefined,
    });
  });
  if (errors.length) return { ok: false, errors: errors.slice(0, 12) };
  return { ok: true, input: { name, questions } };
}

export function relativeTime(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'question-set';
}
