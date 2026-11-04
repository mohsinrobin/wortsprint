// Letter clue for typed questions where more than one word could fit:
// "G _ _ _ _ _ _" (first letter, one mark per letter) pins down which word
// is wanted without giving away its meaning.
import type { Word } from '../types';
import { mightConfuse } from './answer';

/** The answer without article, first written form only ("fahren, fährt" → "fahren"). */
export function answerForm(word: Word): string {
  const first = word.de.split(/,\s*/)[0];
  return word.article && first.startsWith(word.article + ' ') ? first.slice(word.article.length + 1) : first;
}

/** One entry per character: the first letter, then `null` for letters and the character itself for spaces or hyphens. */
export function letterClue(word: Word): (string | null)[] {
  return [...answerForm(word)].map((ch, i) => (i === 0 || !/\p{L}/u.test(ch) ? ch : null));
}

export function letterCount(word: Word): number {
  return [...answerForm(word)].filter((ch) => /\p{L}/u.test(ch)).length;
}

/** Show a clue when a word the learner knows (or sees in this session) shares a meaning. */
export function needsClue(word: Word, known: Iterable<Word>): boolean {
  for (const w of known) if (mightConfuse(w, word)) return true;
  return false;
}
