// Typed-answer checking: capitalization, umlaut spellings (ae/oe/ue/ss),
// required noun articles, optional typo tolerance and synonyms.
import type { Difficulty, TypoTolerance, Word } from '../types';
import { senses } from '../data/parse';

export type Verdict = 'correct' | 'typo' | 'article' | 'synonym' | 'wrong';

export interface CheckResult {
  verdict: Verdict;
  /** True when the answer counts as correct for scoring. */
  ok: boolean;
  expected: string;
  /** The other word the user typed, for 'synonym'. */
  matched?: Word;
  /** For 'article': the article the user typed (or null when missing). */
  givenArticle?: string | null;
}

const ARTICLE_RE = /^(der|die|das|den|dem|des)\s+/;

export function normalize(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’'`´"“”„.!?]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fold umlauts so "strasse" == "straße" and "mude" stays different from "müde". */
export function foldUmlauts(s: string): string {
  return s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}

/** Optimal string alignment (Damerau–Levenshtein) distance. */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

export function allowedTypos(length: number, typo: TypoTolerance, difficulty: Difficulty): number {
  if (typo === 'off' || difficulty === 'extreme') return 0;
  if (typo === 'strict') return length >= 6 ? 1 : 0;
  if (length >= 9) return 2;
  return length >= 4 ? 1 : 0;
}

function splitArticle(s: string): { article: string | null; rest: string } {
  const m = s.match(ARTICLE_RE);
  return m ? { article: m[1], rest: s.slice(m[0].length) } : { article: null, rest: s };
}

interface Form {
  article: string | null;
  rest: string;
}

function formsOf(word: Word): Form[] {
  return word.variants.map((v) => splitArticle(normalize(v)));
}

const same = (a: string, b: string) => a === b || foldUmlauts(a) === foldUmlauts(b);

function exactMatch(input: Form, word: Word): boolean {
  return formsOf(word).some((f) => same(f.rest, input.rest) && (word.article ? f.article === input.article : true));
}

export function sharesMeaning(a: Word, b: Word): boolean {
  const sa = new Set(senses(a.en));
  return senses(b.en).some((s) => sa.has(s));
}

const MAIN_SENSES = 2;

/**
 * Can `other` be accepted in place of `word`? Same part of speech and a shared
 * main meaning (one of the first two listed for both words): "Ticket" for
 * "Fahrkarte" yes, "Anruf" for "Forderung" (both can mean "call") no.
 * Pronouns overlap by grammar ("her" = ihr / sie), not by meaning.
 */
export function canStandIn(other: Word, word: Word): boolean {
  if (!comparable(other, word)) return false;
  const main = new Set(senses(word.en).slice(0, MAIN_SENSES));
  return senses(other.en).slice(0, MAIN_SENSES).some((s) => main.has(s));
}

/** Looser: any shared meaning, so a learner could reasonably think of `other`. */
export function mightConfuse(other: Word, word: Word): boolean {
  return comparable(other, word) && sharesMeaning(other, word);
}

function comparable(other: Word, word: Word): boolean {
  return other.id !== word.id && other.pos === word.pos && word.pos !== 'pronoun' && word.pos !== 'other' && normalize(other.lemma) !== normalize(word.lemma);
}

export interface CheckOptions {
  typo: TypoTolerance;
  difficulty: Difficulty;
  /** Other known words (ideally all of them), for synonym detection and typo safety. */
  pool?: Word[];
}

export function checkTyped(rawInput: string, word: Word, opts: CheckOptions): CheckResult {
  const expected = word.de;
  const input = splitArticle(normalize(rawInput));
  if (!input.rest) return { verdict: 'wrong', ok: false, expected };

  // For non-nouns an article-like first token is part of the answer ("der, die, das").
  const asTyped: Form = word.article ? input : { article: null, rest: normalize(rawInput) };

  if (exactMatch(asTyped, word)) return { verdict: 'correct', ok: true, expected };

  const forms = formsOf(word);
  if (word.article && forms.some((f) => same(f.rest, input.rest))) {
    return { verdict: 'article', ok: false, expected, givenArticle: input.article };
  }

  // Another real word that also fits counts as right; any other real word is wrong.
  const typedOthers = (opts.pool ?? []).filter((w) => w.id !== word.id && exactMatch(w.article ? input : asTyped, w));
  const standIn = typedOthers.find((w) => canStandIn(w, word));
  if (standIn) return { verdict: 'synonym', ok: true, expected, matched: standIn };
  if (typedOthers.length) return { verdict: 'wrong', ok: false, expected, matched: typedOthers[0] };

  // Typo tolerance: compare without article, require same first letter and
  // the right article for nouns.
  const cand = foldUmlauts(asTyped.rest);
  for (const f of forms) {
    const target = foldUmlauts(f.rest);
    const limit = allowedTypos(target.length, opts.typo, opts.difficulty);
    if (limit === 0 || cand[0] !== target[0]) continue;
    if (editDistance(cand, target) <= limit) {
      if (word.article && f.article !== input.article) {
        return { verdict: 'article', ok: false, expected, givenArticle: input.article };
      }
      return { verdict: 'typo', ok: true, expected };
    }
  }
  return { verdict: 'wrong', ok: false, expected };
}
