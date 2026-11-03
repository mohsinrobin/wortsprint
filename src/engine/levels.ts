// Level structure (20 words each), stage flow and completion rules.
import type { LevelProgress, QuestionKind, StageId, StageResult, Word, WordProgress } from '../types';
import { memoryState } from './srs';
import type { SessionSummary } from './session';

export const LEVEL_SIZE = 20;

export const PASS_ACCURACY = 0.85;
export const PASS_TYPING = 0.8;

export interface StageDef {
  id: StageId;
  kind: QuestionKind | null;
}

export const STAGES: StageDef[] = [
  { id: 'learn', kind: 'meaning' },
  { id: 'recognize', kind: 'meaning' },
  { id: 'reverse', kind: 'reverse' },
  { id: 'recall', kind: 'typing' },
  { id: 'situations', kind: 'situation' },
  { id: 'boss', kind: null },
];

export interface Level {
  index: number;
  key: string;
  collectionId: string;
  words: Word[];
}

export function buildLevels(collectionId: string, words: Word[]): Level[] {
  const sorted = [...words].sort((a, b) => a.order - b.order);
  const levels: Level[] = [];
  for (let i = 0; i < sorted.length; i += LEVEL_SIZE) {
    const index = i / LEVEL_SIZE;
    levels.push({ index, key: levelKey(collectionId, index), collectionId, words: sorted.slice(i, i + LEVEL_SIZE) });
  }
  return levels;
}

export const levelKey = (collectionId: string, index: number) => `${collectionId}:${index}`;

export function emptyLevelProgress(key: string): LevelProgress {
  return {
    key,
    stages: {},
    bossPassed: false,
    mastered: false,
    attempts: 0,
    correct: 0,
    typingAttempts: 0,
    typingCorrect: 0,
    recallTested: [],
    lastPlayed: 0,
  };
}

export function isLevelUnlocked(levels: Level[], index: number, progress: Record<string, LevelProgress>): boolean {
  if (index === 0) return true;
  const prev = levels[index - 1];
  return !!prev && !!progress[prev.key]?.bossPassed;
}

export function isStageUnlocked(lp: LevelProgress | undefined, stage: StageId): boolean {
  const i = STAGES.findIndex((s) => s.id === stage);
  if (i <= 0) return true;
  return !!lp?.stages[STAGES[i - 1].id]?.done;
}

/** Stage 1 is a preview + check; others need every word correct at least once. */
export function stageResultFrom(prev: StageResult | undefined, summary: SessionSummary, completed: boolean): StageResult {
  return {
    done: (prev?.done ?? false) || completed,
    attempts: (prev?.attempts ?? 0) + summary.answered,
    correct: (prev?.correct ?? 0) + summary.correct,
    bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, summary.accuracy),
  };
}

export interface BossVerdict {
  accuracy: number;
  typingAccuracy: number;
  passed: boolean;
}

export function evaluateBoss(summary: SessionSummary): BossVerdict {
  const typingAccuracy = summary.typedAnswered ? summary.typingAccuracy : 1;
  return {
    accuracy: summary.accuracy,
    typingAccuracy,
    passed: summary.accuracy >= PASS_ACCURACY && typingAccuracy >= PASS_TYPING,
  };
}

export function applySessionToLevel(
  lp: LevelProgress,
  stage: StageId,
  summary: SessionSummary,
  recallWordIds: string[],
  now: number,
): LevelProgress {
  const completed = stage === 'boss' ? evaluateBoss(summary).passed : true;
  const stages = { ...lp.stages, [stage]: stageResultFrom(lp.stages[stage], summary, completed) };
  return {
    ...lp,
    stages,
    bossPassed: lp.bossPassed || (stage === 'boss' && completed),
    attempts: lp.attempts + summary.answered,
    correct: lp.correct + summary.correct,
    typingAttempts: lp.typingAttempts + summary.typedAnswered,
    typingCorrect: lp.typingCorrect + summary.typedCorrect,
    recallTested: [...new Set([...lp.recallTested, ...recallWordIds])],
    lastPlayed: now,
  };
}

const SCORED: StageId[] = ['recognize', 'reverse', 'recall', 'situations', 'boss'];
const TYPED: StageId[] = ['recall', 'situations'];

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export interface MasteryCheck {
  overall: number;
  typing: number;
  allRecallTested: boolean;
  weakWords: string[];
  requirements: { id: 'boss' | 'overall' | 'typing' | 'recall' | 'weak'; met: boolean }[];
  mastered: boolean;
}

/**
 * Mastery uses each stage's best accuracy (so replaying a stage can raise it),
 * requires recall testing of every word, and no remaining weak words.
 */
export function checkMastery(level: Level, lp: LevelProgress | undefined, progress: Record<string, WordProgress>): MasteryCheck {
  const best = (ids: StageId[]) => mean(ids.map((id) => lp?.stages[id]?.bestAccuracy ?? 0));
  const overall = best(SCORED);
  const typing = best(TYPED);
  const tested = new Set(lp?.recallTested ?? []);
  const allRecallTested = level.words.every((w) => tested.has(w.id));
  const weakWords = level.words.filter((w) => memoryState(progress[w.id]) === 'weak').map((w) => w.id);
  const requirements: MasteryCheck['requirements'] = [
    { id: 'boss', met: !!lp?.bossPassed },
    { id: 'overall', met: overall >= PASS_ACCURACY },
    { id: 'typing', met: typing >= PASS_TYPING },
    { id: 'recall', met: allRecallTested },
    { id: 'weak', met: weakWords.length === 0 },
  ];
  return { overall, typing, allRecallTested, weakWords, requirements, mastered: requirements.every((r) => r.met) };
}

export function stageCount(lp: LevelProgress | undefined): number {
  return STAGES.filter((s) => lp?.stages[s.id]?.done).length;
}
