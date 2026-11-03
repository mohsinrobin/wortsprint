// Builds concrete questions (with distractors) for a word and format.
import type { QuestionKind, Settings, Word } from '../types';
import { normalize, sharesMeaning } from './answer';
import type { Rng } from './rng';
import { shuffle } from './rng';
import { pickSituation } from './situations';
import { splitTopLevel } from '../data/parse';

export interface Option {
  wordId: string;
  text: string;
}

export interface Question {
  kind: QuestionKind;
  word: Word;
  /** Multiple-choice options (meaning, reverse, speed-choice). */
  options?: Option[];
  correctIndex?: number;
  /** Situation text (situation kind). */
  situation?: string;
  /** Typed answer expected. */
  typed: boolean;
}

export function meaningText(word: Word, lang: Settings['meaningLang'], max = 3): string {
  const src = lang === 'bn' && word.bn ? word.bn : word.en;
  const parts = splitTopLevel(src);
  return parts.length > max ? parts.slice(0, max).join(', ') + ' …' : parts.join(', ');
}

export function fullMeaning(word: Word, lang: Settings['meaningLang']): string {
  return lang === 'bn' && word.bn ? `${word.bn} (${word.en})` : word.en;
}

function prefixScore(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return Math.min(i, 4);
}

/** Pick three plausible but unambiguous distractors from the user's own words. */
export function pickDistractors(word: Word, pool: Word[], kind: 'meaning' | 'reverse', rng: Rng, count = 3): Word[] {
  const target = normalize(word.lemma);
  const seenText = new Set<string>([normalize(word.de), normalize(word.en)]);
  const scored = pool
    .filter((w) => w.id !== word.id && !sharesMeaning(w, word) && normalize(w.lemma) !== target)
    .map((w) => {
      let score = rng() * 2;
      if (w.pos === word.pos) score += 3;
      if (kind === 'reverse') {
        score += prefixScore(normalize(w.lemma), target) * 0.8;
        score += Math.abs(w.lemma.length - word.lemma.length) <= 2 ? 1 : 0;
        if (word.article && w.article) score += 0.5;
      } else {
        score += Math.abs(w.en.length - word.en.length) < 12 ? 0.5 : 0;
      }
      return { w, score };
    })
    .sort((a, b) => b.score - a.score);

  const out: Word[] = [];
  for (const { w } of scored) {
    const key = normalize(kind === 'reverse' ? w.de : w.en);
    if (seenText.has(key)) continue;
    seenText.add(key);
    out.push(w);
    if (out.length === count) break;
  }
  return out;
}

export function buildQuestion(
  word: Word,
  kind: QuestionKind,
  pool: Word[],
  rng: Rng,
  settings: Pick<Settings, 'meaningLang' | 'speedInput'>,
  attemptNo = 0,
): Question {
  if (kind === 'typing') return { kind, word, typed: true };
  if (kind === 'situation') return { kind, word, typed: true, situation: pickSituation(word, attemptNo, settings.meaningLang) };
  if (kind === 'speed' && settings.speedInput === 'typing') return { kind, word, typed: true };

  const mcKind = kind === 'meaning' ? 'meaning' : 'reverse';
  const distractors = pickDistractors(word, pool, mcKind, rng);
  const all = shuffle([word, ...distractors], rng);
  const options = all.map((w) => ({
    wordId: w.id,
    text: mcKind === 'meaning' ? meaningText(w, settings.meaningLang) : w.de,
  }));
  return { kind, word, typed: false, options, correctIndex: all.findIndex((w) => w.id === word.id) };
}
