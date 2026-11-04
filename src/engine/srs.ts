// Adaptive repetition: per-word memory strength, spaced intervals and states.
// Pure functions of (progress, outcome, now) so behaviour is deterministic.
import type { MemoryState, QuestionKind, WordProgress } from '../types';

export const DAY = 24 * 60 * 60 * 1000;
/** Spaced repetition ladder in days. */
export const INTERVALS = [1, 3, 7, 14, 30, 60];

export const KIND_ORDER: QuestionKind[] = ['meaning', 'reverse', 'typing', 'situation', 'speed'];
export const RECALL_KINDS: QuestionKind[] = ['typing', 'situation'];

const KIND_WEIGHT: Record<QuestionKind, number> = {
  meaning: 6,
  reverse: 8,
  typing: 13,
  situation: 14,
  speed: 10,
};

export function emptyProgress(wordId: string): WordProgress {
  return {
    wordId,
    encounters: 0,
    correct: 0,
    incorrect: 0,
    typingAttempts: 0,
    typingCorrect: 0,
    avgMs: 0,
    lastSeen: 0,
    streak: 0,
    lapses: 0,
    strength: 0,
    box: 0,
    due: 0,
    ladder: 0,
  };
}

export interface Outcome {
  correct: boolean;
  kind: QuestionKind;
  ms: number;
  limitMs: number;
  /** Typed answer (typing, situation, or speed with typing input). */
  typed: boolean;
  /** Hint used or accepted with a typo: correct but weaker evidence. */
  assisted?: boolean;
}

export type Speed = 'fast' | 'ok' | 'slow';

export function speedOf(ms: number, limitMs: number): Speed {
  if (ms <= limitMs * 0.4) return 'fast';
  if (ms >= limitMs * 0.75) return 'slow';
  return 'ok';
}

export function memoryState(p: WordProgress | undefined): MemoryState {
  if (!p || p.encounters === 0) return 'new';
  const acc = p.correct / p.encounters;
  if (p.streak === 0 && p.incorrect > 0 && (p.incorrect >= 2 || p.strength < 40) && acc < 0.8) return 'weak';
  if (p.incorrect >= 3 && acc < 0.6) return 'weak';
  if (p.strength < 35) return 'learning';
  if (p.strength < 65) return 'familiar';
  if (p.strength >= 90 && p.box >= 3 && p.typingCorrect >= 2 && p.ladder >= 3) return 'mastered';
  return 'strong';
}

export function applyOutcome(prev: WordProgress, o: Outcome, now: number): WordProgress {
  const p: WordProgress = { ...prev, encounters: prev.encounters + 1, lastSeen: now };
  if (prev.encounters === 0) p.firstSeen = now;
  const stateBefore = memoryState(prev);
  const kindIdx = KIND_ORDER.indexOf(o.kind) + 1;
  if (o.typed) p.typingAttempts++;

  if (o.correct) {
    const speed = speedOf(o.ms, o.limitMs);
    p.correct++;
    p.streak++;
    if (o.typed) p.typingCorrect++;
    p.avgMs = prev.correct === 0 ? o.ms : Math.round(prev.avgMs * 0.7 + o.ms * 0.3);
    let gain = KIND_WEIGHT[o.kind] * (speed === 'fast' ? 1.25 : speed === 'slow' ? 0.6 : 1);
    if (o.assisted) gain *= 0.5;
    p.strength = Math.min(100, Math.round(prev.strength + gain));
    p.ladder = Math.max(prev.ladder, kindIdx);

    // Promote on the interval ladder only when the review was actually due,
    // the recall was not slow, and it isn't the recovery right after a miss;
    // in-session repeats keep the schedule.
    const wasDue = prev.due === 0 || now >= prev.due - DAY / 2;
    const recovering = prev.streak === 0 && prev.incorrect > 0;
    if (prev.due === 0 || (wasDue && recovering)) {
      p.box = prev.due === 0 ? 0 : prev.box;
      p.due = now + INTERVALS[p.box] * DAY;
    } else if (wasDue && speed !== 'slow' && !o.assisted) {
      p.box = Math.min(prev.box + 1, INTERVALS.length - 1);
      p.due = now + INTERVALS[p.box] * DAY;
    } else if (wasDue) {
      p.due = now + INTERVALS[prev.box] * DAY;
    }
  } else {
    p.incorrect++;
    p.streak = 0;
    p.lapses++;
    const wasStrong = stateBefore === 'strong' || stateBefore === 'mastered';
    p.strength = Math.max(0, prev.strength - (wasStrong ? 30 : 18));
    p.box = wasStrong ? Math.max(0, prev.box - 2) : 0;
    // Due again right away: it will be picked up by the next review.
    p.due = now;
    if (kindIdx > 0) p.ladder = Math.min(prev.ladder, kindIdx - 1);
  }
  return p;
}

export function isDue(p: WordProgress | undefined, now: number): boolean {
  return !!p && p.encounters > 0 && p.due > 0 && p.due <= now;
}

/** Higher = more urgent to practise. */
export function reviewPriority(p: WordProgress, now: number): number {
  const errorRate = p.encounters ? p.incorrect / p.encounters : 0;
  const overdueDays = p.due > 0 ? Math.max(0, (now - p.due) / DAY) : 0;
  const interval = INTERVALS[p.box] ?? 1;
  const state = memoryState(p);
  return (
    errorRate * 3 +
    Math.min(p.lapses, 6) * 0.4 +
    (state === 'weak' ? 3 : 0) +
    Math.min(overdueDays / interval, 3) +
    (100 - p.strength) / 50
  );
}

/** Format for the next encounter of a word, climbing recognise → recall. */
export function nextKindFor(p: WordProgress | undefined, roll: number): QuestionKind {
  const state = memoryState(p);
  const ladder = p?.ladder ?? 0;
  const level = state === 'weak' ? Math.max(0, ladder - 1) : ladder;
  if (level <= 0) return 'meaning';
  if (level === 1) return 'reverse';
  if (level === 2) return 'typing';
  if (level === 3) return 'situation';
  // Fully climbed: keep recall active, mostly typing formats.
  return roll < 0.4 ? 'typing' : roll < 0.8 ? 'situation' : 'reverse';
}
