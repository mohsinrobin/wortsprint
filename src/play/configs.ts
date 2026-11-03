// Builders for the different kinds of play sessions.
import type { LevelProgress, StageId, Word, WordProgress } from '../types';
import type { Level } from '../engine/levels';
import { STAGES, isLevelUnlocked, isStageUnlocked } from '../engine/levels';
import { reviewPriority } from '../engine/srs';
import type { PlayConfig } from '../store/useStore';
import { translate } from '../i18n/strings';

type Lang = 'en' | 'bn';

export function levelPath(level: Level) {
  return `/c/${encodeURIComponent(level.collectionId)}/l/${level.index}`;
}

export function stagePlay(level: Level, stage: StageId, collectionName: string, lang: Lang): PlayConfig {
  const kind = STAGES.find((s) => s.id === stage)!.kind;
  return {
    title: `${collectionName} · ${translate(lang, 'level')} ${level.index + 1} · ${translate(lang, `stage_${stage}`)}`,
    mode: stage === 'boss' ? { type: 'boss' } : { type: 'stage', kind: kind! },
    wordIds: level.words.map((w) => w.id),
    levelKey: level.key,
    stage,
    returnTo: levelPath(level),
  };
}

export function speedPlay(level: Level, progress: Record<string, WordProgress>, collectionName: string, lang: Lang): PlayConfig {
  const now = Date.now();
  // Later rounds prioritise the words this level finds hardest.
  const hardest = level.words
    .filter((w) => progress[w.id])
    .sort((a, b) => reviewPriority(progress[b.id], now) - reviewPriority(progress[a.id], now))
    .slice(0, Math.min(10, Math.ceil(level.words.length / 2)))
    .map((w) => w.id);
  return {
    title: `${collectionName} · ${translate(lang, 'level')} ${level.index + 1} · ${translate(lang, 'speedChallenge')}`,
    mode: { type: 'speed' },
    wordIds: level.words.map((w) => w.id),
    extra: hardest,
    returnTo: levelPath(level),
  };
}

export function ladderPlay(title: string, words: Word[], returnTo = '/', levelKey?: string): PlayConfig {
  return { title, mode: { type: 'ladder' }, wordIds: words.map((w) => w.id), returnTo, levelKey };
}

/** The next stage to play in a level, or null when all are done. */
export function nextStage(lp: LevelProgress | undefined): StageId | null {
  for (const s of STAGES) if (!lp?.stages[s.id]?.done && isStageUnlocked(lp, s.id)) return s.id;
  return null;
}

/** Where "Continue learning" should go: the most recent unfinished level. */
export function continueTarget(levelsByCollection: { levels: Level[]; name: string }[], progress: Record<string, LevelProgress>): { level: Level; stage: StageId; name: string } | null {
  let best: { level: Level; stage: StageId; name: string; at: number } | null = null;
  for (const { levels, name } of levelsByCollection) {
    for (const level of levels) {
      const lp = progress[level.key];
      if (!lp?.lastPlayed) continue;
      let target: Level | undefined = level;
      let stage = nextStage(lp);
      if (!stage) {
        target = levels[level.index + 1];
        if (!target || !isLevelUnlocked(levels, target.index, progress)) continue;
        stage = nextStage(progress[target.key]) ?? 'learn';
      }
      if (!best || lp.lastPlayed > best.at) best = { level: target, stage, name, at: lp.lastPlayed };
    }
  }
  if (best) return best;
  const first = levelsByCollection.find((c) => c.levels.length);
  return first ? { level: first.levels[0], stage: 'learn', name: first.name } : null;
}
