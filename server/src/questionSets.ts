import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import {
  CHOICE_COUNT,
  DEFAULT_TIME_LIMIT_SEC,
  type ChoiceIndex,
  type Question,
  type QuestionSet,
  type QuestionSetInput,
} from '../../shared/protocol.ts';

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
const DATA_FILE = path.join(DATA_DIR, 'question-sets.json');

const MAX_QUESTIONS = 100;
const MIN_TIME_LIMIT_SEC = 5;
const MAX_TIME_LIMIT_SEC = 120;
const MAX_NAME_LEN = 100;
const MAX_TEXT_LEN = 500;
const MAX_CHOICE_LEN = 200;

export class ValidationError extends Error {
  readonly status = 400;
}

export class NotFoundError extends Error {
  readonly status = 404;
}

let sets: QuestionSet[] = [];

// ---------- persistence ----------

function persist(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(sets, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

function load(): void {
  if (!fs.existsSync(DATA_FILE)) {
    sets = seedSets();
    persist();
    return;
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const parsed: unknown = raw.trim() ? JSON.parse(raw) : [];
  if (!Array.isArray(parsed)) throw new Error(`${DATA_FILE} does not contain an array`);
  sets = parsed as QuestionSet[];
}

// ---------- validation ----------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cleanString(v: unknown, label: string, max: number): string {
  if (typeof v !== 'string') throw new ValidationError(`${label} must be a string`);
  const s = v.trim();
  if (!s) throw new ValidationError(`${label} must not be empty`);
  if (s.length > max) throw new ValidationError(`${label} must be at most ${max} characters`);
  return s;
}

function validateQuestion(raw: unknown, i: number): Question {
  const label = `Question ${i + 1}`;
  if (!isRecord(raw)) throw new ValidationError(`${label} must be an object`);

  const text = cleanString(raw.text, `${label} text`, MAX_TEXT_LEN);

  if (!Array.isArray(raw.choices) || raw.choices.length !== CHOICE_COUNT) {
    throw new ValidationError(`${label} must have exactly ${CHOICE_COUNT} choices`);
  }
  const choices = raw.choices.map((c, j) => cleanString(c, `${label} choice ${j + 1}`, MAX_CHOICE_LEN)) as [
    string, string, string, string,
  ];

  const ci = raw.correctIndex;
  if (typeof ci !== 'number' || !Number.isInteger(ci) || ci < 0 || ci >= CHOICE_COUNT) {
    throw new ValidationError(`${label} correctIndex must be an integer from 0 to ${CHOICE_COUNT - 1}`);
  }

  let timeLimitSec = DEFAULT_TIME_LIMIT_SEC;
  if (raw.timeLimitSec !== undefined && raw.timeLimitSec !== null) {
    const t = raw.timeLimitSec;
    if (typeof t !== 'number' || !Number.isFinite(t)) {
      throw new ValidationError(`${label} timeLimitSec must be a number`);
    }
    timeLimitSec = Math.round(t);
    if (timeLimitSec < MIN_TIME_LIMIT_SEC || timeLimitSec > MAX_TIME_LIMIT_SEC) {
      throw new ValidationError(
        `${label} timeLimitSec must be between ${MIN_TIME_LIMIT_SEC} and ${MAX_TIME_LIMIT_SEC}`,
      );
    }
  }

  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 64) : nanoid(10);
  return { id, text, choices, correctIndex: ci as ChoiceIndex, timeLimitSec };
}

/** Validates untrusted input and returns clean name + questions (with ids filled in). */
export function validateInput(raw: unknown): { name: string; questions: Question[] } {
  if (!isRecord(raw)) throw new ValidationError('Body must be an object');
  const name = cleanString(raw.name, 'Name', MAX_NAME_LEN);
  if (!Array.isArray(raw.questions)) throw new ValidationError('questions must be an array');
  if (raw.questions.length < 1 || raw.questions.length > MAX_QUESTIONS) {
    throw new ValidationError(`A set needs between 1 and ${MAX_QUESTIONS} questions`);
  }
  const questions = raw.questions.map(validateQuestion);
  // Guard against duplicate question ids within a set (e.g. copy/pasted rows).
  const seen = new Set<string>();
  for (const q of questions) {
    if (seen.has(q.id)) q.id = nanoid(10);
    seen.add(q.id);
  }
  return { name, questions };
}

// ---------- CRUD ----------

export function list(): QuestionSet[] {
  return sets.map((s) => structuredClone(s));
}

export function get(id: string): QuestionSet | undefined {
  const s = sets.find((x) => x.id === id);
  return s ? structuredClone(s) : undefined;
}

export function create(input: QuestionSetInput | unknown): QuestionSet {
  const { name, questions } = validateInput(input);
  const now = Date.now();
  const set: QuestionSet = { id: nanoid(10), name, questions, createdAt: now, updatedAt: now };
  sets.push(set);
  persist();
  return structuredClone(set);
}

export function update(id: string, input: QuestionSetInput | unknown): QuestionSet {
  const idx = sets.findIndex((x) => x.id === id);
  if (idx === -1) throw new NotFoundError('Question set not found');
  const { name, questions } = validateInput(input);
  const existing = sets[idx]!;
  const updated: QuestionSet = { ...existing, name, questions, updatedAt: Date.now() };
  sets[idx] = updated;
  persist();
  return structuredClone(updated);
}

export function remove(id: string): void {
  const idx = sets.findIndex((x) => x.id === id);
  if (idx === -1) throw new NotFoundError('Question set not found');
  sets.splice(idx, 1);
  persist();
}

// ---------- seed ----------

function q(
  text: string,
  choices: [string, string, string, string],
  correctIndex: ChoiceIndex,
  timeLimitSec = DEFAULT_TIME_LIMIT_SEC,
): Question {
  return { id: nanoid(10), text, choices, correctIndex, timeLimitSec };
}

function seedSets(): QuestionSet[] {
  const now = Date.now();
  return [{
    id: nanoid(10),
    name: 'Claude Builder Club Trivia',
    createdAt: now,
    updatedAt: now,
    questions: [
      q('Who founded Anthropic?',
        ['Sam Altman & Greg Brockman', 'Dario & Daniela Amodei', 'Demis Hassabis & Mustafa Suleyman', 'Elon Musk'], 1),
      q('What tool lets you use Claude right in your terminal?',
        ['Claude Code', 'Claude Shell', 'Claude CLI Pro', 'Claude Desktop'], 0),
      q('Which Claude model is the fastest and cheapest?',
        ['Opus', 'Sonnet', 'Fable', 'Haiku'], 3),
      q('What does MCP stand for?',
        ['Machine Code Protocol', 'Multi-Chain Prompting', 'Model Context Protocol', 'Managed Compute Platform'], 2),
      q('Who was Claude named after?',
        ['Claude Monet', 'Claude Shannon', 'Claude Debussy', 'Jean-Claude Van Damme'], 1),
      q("How large is Claude's context window?",
        ['32K tokens', '200K tokens', '10 million tokens', '1 million tokens'], 3),
      q('Which command scans your repo and generates a CLAUDE.md?',
        ['/setup', '/memory', '/init', '/scan'], 2),
      q('Which macOS command keeps your Mac awake so Claude can keep working while you step away?',
        ['nosleep', 'caffeinate', 'stayawake', 'insomnia'], 1),
      q("What's Anthropic's training approach where Claude learns from a written set of principles?",
        ['Constitutional AI', 'Principled RLHF', 'Rulebook Tuning', 'Charter Learning'], 0, 25),
      q("What's Anthropic's newest launch, a proactive agent app that keeps working while you're away?",
        ['Claude Dashboards', 'Claude Motion', 'Claude Cowork', 'Claude Duet'], 3, 25),
    ],
  }, {
    id: nanoid(10),
    name: 'Guess the Emoji',
    createdAt: now,
    updatedAt: now,
    questions: [
      q('Movie: 🤠🚀5️⃣',
        ['Toy Story 4', 'Lightyear', 'Toy Story 5', 'Inside Out 2'], 2),
      q('Brand: 👹🧸🦷',
        ['Labubu', 'Squishmallows', 'Jellycat', 'Sonny Angel'], 0),
      q('Movie: 🧤✨🕺',
        ['Elvis', 'Rocketman', 'Bohemian Rhapsody', 'Michael'], 3),
      q('Song: 🌸🌊👸',
        ['Opalite', 'The Fate of Ophelia', 'Elizabeth Taylor', 'Actually Romantic'], 1),
      q('Movie: 🕷️🆕☀️',
        ['Spider-Man: No Way Home', 'Spider-Man: Across the Spider-Verse', 'Spider-Man: Brand New Day', 'Spider-Man: Beyond the Spider-Verse'], 2, 25),
      q('Brand: 🍋🧘‍♀️',
        ['Lululemon', 'Alo Yoga', 'Vuori', 'Athleta'], 0, 25),
      q('Song: 🤔✅🤠⭐',
        ["Texas Hold 'Em", 'A Bar Song (Tipsy)', 'Pink Pony Club', "Choosin' Texas"], 3, 25),
      q('Movie: ⛵🏝️🐑👁️',
        ['Gladiator II', 'The Odyssey', 'Troy', '300: Rise of an Empire'], 1, 25),
      q('Brand: 💧💀',
        ['Liquid I.V.', 'Celsius', 'Liquid Death', 'Prime'], 2, 30),
      q('Song: 📍🏠4️⃣♾️',
        ['Hate That I Made You Love Me', 'Stay Here 4 Life', 'Drop Dead', 'Patient Zero'], 1, 30),
      q('Brand: 🥤🚗🔥',
        ['Owala', 'Stanley', 'Yeti', 'Hydro Flask'], 1, 30),
      q('Song: 👩🤫',
        ['Nokia', 'What Did I Miss?', 'Gimme a Hug', 'Janice STFU'], 3, 30),
    ],
  }];
}

load();
