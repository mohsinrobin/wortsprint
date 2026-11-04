// Dashboard aggregates, streaks, XP and badges.
import type { MemoryState, Profile, Word, WordProgress } from '../types';
import { isDue, memoryState, reviewPriority } from './srs';

export function localDay(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Consecutive practice days ending today (or yesterday, so it survives until midnight). */
export function currentStreak(days: string[], now: number): number {
  const set = new Set(days);
  const dayMs = 86400000;
  let cursor = now;
  if (!set.has(localDay(cursor))) cursor -= dayMs;
  let n = 0;
  while (set.has(localDay(cursor))) {
    n++;
    cursor -= dayMs;
  }
  return n;
}

export interface Overview {
  total: number;
  learned: number;
  mastered: number;
  weak: number;
  due: number;
  byState: Record<MemoryState, number>;
  accuracy: number;
  avgMs: number;
  /** Words answered for the first time in the last 7 days. */
  week: number;
  /** Earliest review time among started words (0 = none scheduled). */
  nextDue: number;
}

export function overview(words: Word[], progress: Record<string, WordProgress>, now: number): Overview {
  const byState: Record<MemoryState, number> = { new: 0, learning: 0, weak: 0, familiar: 0, strong: 0, mastered: 0 };
  let due = 0;
  let enc = 0;
  let cor = 0;
  let msSum = 0;
  let msN = 0;
  let week = 0;
  let nextDue = 0;
  const weekAgo = now - 7 * 86400000;
  for (const w of words) {
    const p = progress[w.id];
    byState[memoryState(p)]++;
    if (isDue(p, now)) due++;
    if (p) {
      if (p.firstSeen && p.firstSeen >= weekAgo) week++;
      if (p.due && (!nextDue || p.due < nextDue)) nextDue = p.due;
      enc += p.encounters;
      cor += p.correct;
      if (p.correct) {
        msSum += p.avgMs;
        msN++;
      }
    }
  }
  return {
    total: words.length,
    learned: words.length - byState.new,
    mastered: byState.mastered,
    weak: byState.weak,
    due,
    byState,
    accuracy: enc ? cor / enc : 0,
    avgMs: msN ? Math.round(msSum / msN) : 0,
    week,
    nextDue,
  };
}

/** Words due for review, most urgent first; topped up with weak words. */
export function selectReview(words: Word[], progress: Record<string, WordProgress>, now: number, size: number): Word[] {
  const due = words.filter((w) => isDue(progress[w.id], now));
  const ranked = due.sort((a, b) => reviewPriority(progress[b.id], now) - reviewPriority(progress[a.id], now));
  if (ranked.length >= size) return ranked.slice(0, size);
  const extra = selectWeak(words, progress, now, size).filter((w) => !ranked.includes(w));
  return [...ranked, ...extra].slice(0, size);
}

/** Words the learner frequently gets wrong. */
export function selectWeak(words: Word[], progress: Record<string, WordProgress>, now: number, size: number): Word[] {
  return words
    .filter((w) => {
      const p = progress[w.id];
      return p && p.incorrect > 0 && (memoryState(p) === 'weak' || p.incorrect / p.encounters >= 0.25 || p.lapses >= 2);
    })
    .sort((a, b) => reviewPriority(progress[b.id], now) - reviewPriority(progress[a.id], now))
    .slice(0, size);
}

export interface BadgeDef {
  id: string;
  test: (ctx: BadgeContext) => boolean;
}

export interface BadgeContext {
  profile: Profile;
  streak: number;
  mastered: number;
  levelsPassed: number;
  lastSession?: { accuracy: number; answered: number; speedScore?: number; maxCombo?: number };
}

export const BADGES: BadgeDef[] = [
  { id: 'first-session', test: (c) => c.profile.sessions >= 1 },
  { id: 'first-level', test: (c) => c.levelsPassed >= 1 },
  { id: 'five-levels', test: (c) => c.levelsPassed >= 5 },
  { id: 'streak-3', test: (c) => c.streak >= 3 },
  { id: 'streak-7', test: (c) => c.streak >= 7 },
  { id: 'streak-30', test: (c) => c.streak >= 30 },
  { id: 'mastered-25', test: (c) => c.mastered >= 25 },
  { id: 'mastered-100', test: (c) => c.mastered >= 100 },
  { id: 'perfect', test: (c) => !!c.lastSession && c.lastSession.answered >= 10 && c.lastSession.accuracy === 1 },
  { id: 'combo-15', test: (c) => (c.lastSession?.maxCombo ?? 0) >= 15 },
  { id: 'xp-1000', test: (c) => c.profile.xp >= 1000 },
  { id: 'xp-10000', test: (c) => c.profile.xp >= 10000 },
];

export function newBadges(ctx: BadgeContext): string[] {
  return BADGES.filter((b) => !ctx.profile.badges.includes(b.id) && b.test(ctx)).map((b) => b.id);
}

export function xpFor(kind: string, correct: boolean, fast: boolean, multiplier = 1): number {
  if (!correct) return 0;
  const base = kind === 'meaning' ? 5 : kind === 'reverse' ? 7 : kind === 'typing' ? 12 : kind === 'situation' ? 14 : 8;
  return Math.round((base + (fast ? 3 : 0)) * multiplier);
}

export function levelFromXp(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let need = 200;
  let rest = xp;
  while (rest >= need) {
    rest -= need;
    level++;
    need = Math.round(need * 1.25);
  }
  return { level, into: rest, need };
}
