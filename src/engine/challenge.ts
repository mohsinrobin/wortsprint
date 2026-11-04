// Mutprobe: 50 fixed hard-mode tests across all bundled lists. No learning
// step, no hints, hard timers; three mistakes end the run.
import data from '../data/challenges.json';
import type { WordProgress } from '../types';
import { memoryState } from './srs';

export const LIVES = 3;
/** Below this share of known words the start screen warns before starting. */
export const READY_AT = 0.6;

export const CHALLENGES: string[][] = data.challenges;

export interface ChallengeResult {
  attempts: number;
  passed: boolean;
  /** Most correct answers in one run. */
  best: number;
  lastPlayed: number;
}

/** Share of the challenge's words the learner already knows reasonably well. */
export function readiness(ids: string[], progress: Record<string, WordProgress>): number {
  if (!ids.length) return 0;
  const known = ids.filter((id) => {
    const s = memoryState(progress[id]);
    return s === 'familiar' || s === 'strong' || s === 'mastered';
  }).length;
  return known / ids.length;
}

export function isChallengeUnlocked(index: number, results: Record<string, ChallengeResult>): boolean {
  return index === 0 || !!results[index - 1]?.passed;
}

/** Collection ids in the order they appear, e.g. ['a1', 'a2']. */
export function challengeTiers(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.slice(0, id.indexOf('-'))))];
}

export function challengePassed(answered: number, correct: number, total: number): boolean {
  return answered >= total && answered - correct < LIVES;
}
