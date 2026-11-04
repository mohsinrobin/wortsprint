// Session scheduler: a pure state machine deciding which word/format comes
// next. Misses come back after 3–5 other questions, slow answers once more
// later in the session, and the same word is never shown back-to-back when
// another option exists.
import type { QuestionKind } from '../types';
import { createRng, randInt, shuffle } from './rng';
import { speedOf } from './srs';

export type SessionMode =
  /** One format; repeat until every word has been answered correctly. */
  | { type: 'stage'; kind: QuestionKind }
  /** Per-word format chosen by memory progress (reviews, weak words). */
  | { type: 'ladder' }
  /** Final memory boss: mixed formats, each word once, no second chances. */
  | { type: 'boss' }
  /** Speed challenge: fixed list, no repeats. */
  | { type: 'speed' }
  /** Mutprobe: like the boss (mixed formats, each word once), with lives. */
  | { type: 'challenge' };

export interface SessionItem {
  wordId: string;
  kind: QuestionKind;
  /** How many times this word was asked before in this session. */
  attemptNo: number;
}

export interface AnswerRecord {
  wordId: string;
  kind: QuestionKind;
  correct: boolean;
  ms: number;
  limitMs: number;
  typed: boolean;
}

export interface SessionState {
  mode: SessionMode;
  seed: number;
  step: number;
  wordIds: string[];
  queue: SessionItem[];
  history: AnswerRecord[];
  attempts: Record<string, number>;
  slowRepeated: Record<string, boolean>;
  retryGap: 'immediate' | 'later';
  maxAttemptsPerWord: number;
}

export interface CreateOptions {
  mode: SessionMode;
  wordIds: string[];
  seed: number;
  retryGap?: 'immediate' | 'later';
  /** Format per word for ladder mode (roll is a deterministic 0..1 value). */
  kindFor?: (wordId: string, roll: number) => QuestionKind;
  /** Extra questions appended for speed rounds (hardest words). */
  extra?: string[];
  maxAttemptsPerWord?: number;
}

const BOSS_KINDS: QuestionKind[] = ['reverse', 'typing', 'situation', 'typing', 'situation'];

export const EASIER: Record<QuestionKind, QuestionKind> = {
  meaning: 'meaning',
  reverse: 'meaning',
  typing: 'reverse',
  situation: 'typing',
  speed: 'reverse',
};

export function createSession(o: CreateOptions): SessionState {
  const rng = createRng(o.seed);
  const order = shuffle(o.wordIds, rng);
  let queue: SessionItem[];
  switch (o.mode.type) {
    case 'stage': {
      const kind = o.mode.kind;
      queue = order.map((wordId) => ({ wordId, kind, attemptNo: 0 }));
      break;
    }
    case 'ladder':
      queue = order.map((wordId) => ({ wordId, kind: o.kindFor ? o.kindFor(wordId, rng()) : 'meaning', attemptNo: 0 }));
      break;
    case 'boss':
    case 'challenge': {
      const kinds = shuffle(order.map((_, i) => BOSS_KINDS[i % BOSS_KINDS.length]), rng);
      queue = order.map((wordId, i) => ({ wordId, kind: kinds[i], attemptNo: 0 }));
      break;
    }
    case 'speed':
      queue = [...order, ...(o.extra ?? [])].map((wordId) => ({ wordId, kind: 'speed' as const, attemptNo: 0 }));
      queue = spreadDuplicates(queue);
      break;
  }
  return {
    mode: o.mode,
    seed: o.seed,
    step: 0,
    wordIds: [...o.wordIds],
    queue,
    history: [],
    attempts: {},
    slowRepeated: {},
    retryGap: o.retryGap ?? 'later',
    maxAttemptsPerWord: o.maxAttemptsPerWord ?? 5,
  };
}

/** Reorder so no two adjacent items share a word (when possible). */
function spreadDuplicates(items: SessionItem[]): SessionItem[] {
  const out = [...items];
  for (let i = 1; i < out.length; i++) {
    if (out[i].wordId !== out[i - 1].wordId) continue;
    const j = out.findIndex((it, k) => k > i && it.wordId !== out[i - 1].wordId && it.wordId !== out[k - 1]?.wordId);
    if (j > 0) [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function currentItem(s: SessionState): SessionItem | null {
  return s.queue[0] ?? null;
}

export function isFinished(s: SessionState): boolean {
  return s.queue.length === 0;
}

function insertAt(queue: SessionItem[], index: number, item: SessionItem): SessionItem[] {
  const q = [...queue];
  q.splice(Math.min(Math.max(index, 1), q.length), 0, item);
  return q;
}

export interface AnswerInput {
  correct: boolean;
  ms: number;
  limitMs: number;
  typed: boolean;
}

export function answerCurrent(s: SessionState, a: AnswerInput): SessionState {
  const item = s.queue[0];
  if (!item) return s;
  const rng = createRng(s.seed + (s.step + 1) * 7919);
  let queue = s.queue.slice(1);
  const attempts = { ...s.attempts, [item.wordId]: (s.attempts[item.wordId] ?? 0) + 1 };
  const slowRepeated = { ...s.slowRepeated };
  const record: AnswerRecord = { wordId: item.wordId, kind: item.kind, ...a };
  const canRetry = attempts[item.wordId] < s.maxAttemptsPerWord;
  const repeating = s.mode.type === 'stage' || s.mode.type === 'ladder';

  if (repeating && canRetry) {
    const next = (kind: QuestionKind): SessionItem => ({ wordId: item.wordId, kind, attemptNo: attempts[item.wordId] });
    if (!a.correct) {
      const gap = s.retryGap === 'immediate' ? 1 : randInt(rng, 3, 5);
      if (s.mode.type === 'ladder' && EASIER[item.kind] !== item.kind) {
        // Step down one format first, then come back to the harder one.
        queue = insertAt(queue, gap, next(EASIER[item.kind]));
        queue = insertAt(queue, gap + randInt(rng, 3, 5), next(item.kind));
      } else {
        queue = insertAt(queue, gap, next(item.kind));
      }
    } else if (speedOf(a.ms, a.limitMs) === 'slow' && !slowRepeated[item.wordId]) {
      slowRepeated[item.wordId] = true;
      queue = insertAt(queue, randInt(rng, 6, 9), next(item.kind));
    }
  }

  // Never show the same word twice in a row when there is an alternative.
  if (queue.length > 1 && queue[0].wordId === item.wordId) {
    const j = queue.findIndex((it) => it.wordId !== item.wordId);
    if (j > 0) [queue[0], queue[j]] = [queue[j], queue[0]];
  }

  return { ...s, step: s.step + 1, queue, history: [...s.history, record], attempts, slowRepeated };
}

export interface SessionProgress {
  done: number;
  total: number;
}

export function sessionProgress(s: SessionState): SessionProgress {
  if (s.mode.type === 'boss' || s.mode.type === 'speed' || s.mode.type === 'challenge') {
    return { done: s.history.length, total: s.history.length + s.queue.length };
  }
  const pending = new Set(s.queue.map((q) => q.wordId));
  const total = new Set(s.wordIds).size;
  return { done: total - pending.size, total };
}

export interface WordResult {
  wordId: string;
  correct: number;
  wrong: number;
  firstTry: boolean;
  avgMs: number;
}

export interface SessionSummary {
  answered: number;
  correct: number;
  accuracy: number;
  typedAnswered: number;
  typedCorrect: number;
  typingAccuracy: number;
  avgMs: number;
  words: WordResult[];
  /** Words answered right first time. */
  solid: string[];
  /** Words that needed repeats or failed. */
  needsPractice: string[];
}

export function summarize(history: AnswerRecord[]): SessionSummary {
  const by = new Map<string, AnswerRecord[]>();
  for (const r of history) by.set(r.wordId, [...(by.get(r.wordId) ?? []), r]);
  const words: WordResult[] = [...by.entries()].map(([wordId, recs]) => {
    const ok = recs.filter((r) => r.correct);
    return {
      wordId,
      correct: ok.length,
      wrong: recs.length - ok.length,
      firstTry: recs[0].correct,
      avgMs: ok.length ? Math.round(ok.reduce((n, r) => n + r.ms, 0) / ok.length) : 0,
    };
  });
  const correct = history.filter((r) => r.correct);
  const typed = history.filter((r) => r.typed);
  const typedCorrect = typed.filter((r) => r.correct).length;
  return {
    answered: history.length,
    correct: correct.length,
    accuracy: history.length ? correct.length / history.length : 0,
    typedAnswered: typed.length,
    typedCorrect,
    typingAccuracy: typed.length ? typedCorrect / typed.length : 0,
    avgMs: correct.length ? Math.round(correct.reduce((n, r) => n + r.ms, 0) / correct.length) : 0,
    words,
    solid: words.filter((w) => w.firstTry && w.wrong === 0).map((w) => w.wordId),
    needsPractice: words.filter((w) => w.wrong > 0).map((w) => w.wordId),
  };
}
