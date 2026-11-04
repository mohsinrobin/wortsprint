import { describe, expect, it } from 'vitest';
import type { Word } from '../types';
import { parseAny, parseGerman, parseText, expandOptional } from '../data/parse';
import { checkTyped, editDistance } from './answer';
import { applyOutcome, emptyProgress, isDue, memoryState, DAY, nextKindFor } from './srs';
import { answerCurrent, createSession, currentItem, isFinished, sessionProgress, summarize } from './session';
import { buildLevels, checkMastery, evaluateBoss, isLevelUnlocked, emptyLevelProgress, applySessionToLevel } from './levels';
import { buildQuestion, pickDistractors } from './questions';
import { createRng } from './rng';
import { currentStreak, localDay, selectReview } from './stats';
import { pickSituation, templateSituations } from './situations';

function word(de: string, en: string, pos?: Word['pos'], i = 0): Word {
  const g = parseGerman(de, pos);
  return { id: `t-${i}-${g.lemma}`, collectionId: 't', order: i, en, ...g };
}

const apfel = word('Apfel, der', 'apple', 'noun', 1);
const vergessen = word('vergessen', 'to forget', 'verb', 2);
const strasse = word('Straße, die', 'street, road', 'noun', 3);
const muede = word('müde', 'tired, weary', 'adjective', 4);
const fahrkarte = word('Fahrkarte, die', 'ticket', 'noun', 5);
const ticket = word('Ticket, das', 'ticket', 'noun', 6);
const opts = { typo: 'lenient' as const, difficulty: 'normal' as const };

describe('parsing', () => {
  it('reads the "Wort, der — meaning" format with sections', () => {
    const r = parseText('A1 Noun\n\nApfel, der — apple\n---\nA1 Verbs\nvergessen — to forget\n');
    expect(r.issues).toHaveLength(0);
    expect(r.entries[0]).toMatchObject({ de: 'der Apfel', lemma: 'Apfel', article: 'der', pos: 'noun' });
    expect(r.entries[1]).toMatchObject({ de: 'vergessen', pos: 'verb' });
  });

  it('reads the pipe format with Bengali', () => {
    const r = parseAny('der Apfel | apple | আপেল\nschnell | fast | দ্রুত');
    expect(r.entries[0]).toMatchObject({ article: 'der', lemma: 'Apfel', en: 'apple', bn: 'আপেল' });
    expect(r.entries[1].bn).toBe('দ্রুত');
  });

  it('validates CSV rows', () => {
    const r = parseAny('german,english,bengali\nder Apfel,apple,আপেল\n,missing,\n"das Brot","bread, loaf",রুটি', 'x.csv');
    expect(r.entries).toHaveLength(2);
    expect(r.entries[1].en).toBe('bread, loaf');
    expect(r.issues[0].reason).toMatch(/Missing German/);
  });

  it('reads JSON arrays and reports bad items', () => {
    const r = parseAny('[{"german":"der Apfel","english":"apple"},{"german":"x"}]', 'a.json');
    expect(r.entries).toHaveLength(1);
    expect(r.issues).toHaveLength(1);
  });

  it('expands optional parts and alternative spellings', () => {
    expect(expandOptional('Disko(thek)')).toEqual(['Disko', 'Diskothek']);
    const g = parseGerman('(sich) vorstellen', 'verb');
    expect(g.variants).toEqual(expect.arrayContaining(['vorstellen', 'sich vorstellen']));
    const n = parseGerman('Großeltern, pl., die', 'noun');
    expect(n.variants).toEqual(['die Großeltern']);
  });
});

describe('answer checking', () => {
  it('requires the article for nouns', () => {
    expect(checkTyped('der Apfel', apfel, opts).verdict).toBe('correct');
    expect(checkTyped('Der apfel', apfel, opts).verdict).toBe('correct');
    expect(checkTyped('Apfel', apfel, opts)).toMatchObject({ verdict: 'article', ok: false, givenArticle: null });
    expect(checkTyped('die Apfel', apfel, opts)).toMatchObject({ verdict: 'article', ok: false });
  });

  it('accepts umlaut and ß spellings', () => {
    expect(checkTyped('die Strasse', strasse, opts).verdict).toBe('correct');
    expect(checkTyped('muede', muede, opts).verdict).toBe('correct');
  });

  it('tolerates small typos but not different words', () => {
    expect(checkTyped('vergesen', vergessen, opts).verdict).toBe('typo');
    expect(checkTyped('vergesen', vergessen, { ...opts, typo: 'off' }).verdict).toBe('wrong');
    expect(checkTyped('verstehen', vergessen, opts).verdict).toBe('wrong');
    expect(checkTyped('wergessen', vergessen, opts).verdict).toBe('wrong');
    expect(checkTyped('vergesen', vergessen, { ...opts, difficulty: 'extreme' }).verdict).toBe('wrong');
  });

  it('accepts another word with the same meaning', () => {
    const r = checkTyped('das Ticket', fahrkarte, { ...opts, pool: [fahrkarte, ticket] });
    expect(r.verdict).toBe('synonym');
    expect(r.ok).toBe(true);
  });

  it('does not accept a shared meaning across parts of speech or for pronouns', () => {
    const koennen = word('können', 'to be able to, can', 'verb', 40);
    const kanne = word('Kanne, die', 'can, jug', 'noun', 41);
    expect(checkTyped('die Kanne', koennen, { ...opts, pool: [koennen, kanne] }).ok).toBe(false);
    const ihr = word('ihr', 'you (pl.), her', 'pronoun', 42);
    const sie = word('sie', 'she, her, they', 'pronoun', 43);
    expect(checkTyped('sie', ihr, { ...opts, pool: [ihr, sie] }).ok).toBe(false);
  });

  it('computes edit distance with transpositions', () => {
    expect(editDistance('schnell', 'shcnell')).toBe(1);
    expect(editDistance('abc', 'abc')).toBe(0);
  });
});

describe('spaced repetition', () => {
  const now = 1_700_000_000_000;
  const correct = { correct: true, kind: 'typing' as const, ms: 2000, limitMs: 12000, typed: true };

  it('schedules 1 → 3 → 7 days when reviews are on time', () => {
    let p = applyOutcome(emptyProgress('w'), correct, now);
    expect(p.due).toBe(now + DAY);
    p = applyOutcome(p, correct, now + DAY);
    expect(p.due).toBe(now + DAY + 3 * DAY);
    p = applyOutcome(p, correct, now + 4 * DAY);
    expect(p.due).toBe(now + 4 * DAY + 7 * DAY);
  });

  it('does not promote on in-session repeats or slow answers', () => {
    const p1 = applyOutcome(emptyProgress('w'), correct, now);
    const p2 = applyOutcome(p1, correct, now + 1000);
    expect(p2.box).toBe(p1.box);
    const slow = applyOutcome(p1, { ...correct, ms: 11000 }, now + DAY);
    expect(slow.box).toBe(p1.box);
  });

  it('demotes and marks due on a miss, harder when it was strong', () => {
    const strong = { ...emptyProgress('w'), encounters: 10, correct: 10, strength: 80, box: 3, due: now + DAY, ladder: 4, typingCorrect: 4 };
    expect(memoryState(strong)).toBe('strong');
    const missed = applyOutcome(strong, { ...correct, correct: false }, now);
    expect(missed.strength).toBe(50);
    expect(missed.box).toBe(1);
    expect(isDue(missed, now)).toBe(true);
  });

  it('does not promote the correct retry right after a miss', () => {
    const missed = applyOutcome(emptyProgress('w'), { ...correct, correct: false }, now);
    const retry = applyOutcome(missed, correct, now + 60_000);
    expect(retry.box).toBe(0);
    expect(retry.due).toBe(now + 60_000 + DAY);
    const nextDay = applyOutcome(retry, correct, retry.due);
    expect(nextDay.box).toBe(1);
  });

  it('flags repeatedly forgotten words as weak', () => {
    let p = emptyProgress('w');
    for (let i = 0; i < 3; i++) p = applyOutcome(p, { ...correct, correct: false }, now + i);
    expect(memoryState(p)).toBe('weak');
  });

  it('climbs formats from recognition to recall', () => {
    let p = emptyProgress('w');
    expect(nextKindFor(p, 0)).toBe('meaning');
    p = applyOutcome(p, { ...correct, kind: 'meaning', typed: false }, now);
    expect(nextKindFor(p, 0)).toBe('reverse');
    p = applyOutcome(p, { ...correct, kind: 'reverse', typed: false }, now);
    expect(nextKindFor(p, 0)).toBe('typing');
  });
});

describe('session scheduler', () => {
  const ids = Array.from({ length: 10 }, (_, i) => `w${i}`);
  const ok = { correct: true, ms: 1000, limitMs: 8000, typed: false };
  const bad = { ...ok, correct: false };

  it('is deterministic for a seed', () => {
    const a = createSession({ mode: { type: 'stage', kind: 'meaning' }, wordIds: ids, seed: 42 });
    const b = createSession({ mode: { type: 'stage', kind: 'meaning' }, wordIds: ids, seed: 42 });
    expect(a.queue).toEqual(b.queue);
  });

  it('brings a missed word back after 3–5 other questions', () => {
    let s = createSession({ mode: { type: 'stage', kind: 'meaning' }, wordIds: ids, seed: 1 });
    const missed = currentItem(s)!.wordId;
    s = answerCurrent(s, bad);
    const pos = s.queue.findIndex((q) => q.wordId === missed);
    expect(pos).toBeGreaterThanOrEqual(3);
    expect(pos).toBeLessThanOrEqual(5);
  });

  it('repeats slow correct answers once', () => {
    let s = createSession({ mode: { type: 'stage', kind: 'meaning' }, wordIds: ids, seed: 3 });
    const w = currentItem(s)!.wordId;
    s = answerCurrent(s, { ...ok, ms: 7000 });
    expect(s.queue.filter((q) => q.wordId === w)).toHaveLength(1);
  });

  it('steps down a format after a miss in ladder mode', () => {
    let s = createSession({ mode: { type: 'ladder' }, wordIds: ids, seed: 5, kindFor: () => 'typing' });
    const w = currentItem(s)!.wordId;
    s = answerCurrent(s, { ...bad, typed: true });
    const kinds = s.queue.filter((q) => q.wordId === w).map((q) => q.kind);
    expect(kinds).toEqual(['reverse', 'typing']);
  });

  it('never shows the same word back to back while alternatives exist', () => {
    let s = createSession({ mode: { type: 'stage', kind: 'meaning' }, wordIds: ['a', 'b'], seed: 9, retryGap: 'immediate' });
    let last = '';
    let guard = 0;
    while (!isFinished(s) && guard++ < 50) {
      const it = currentItem(s)!;
      if (s.queue.length > 1) expect(it.wordId).not.toBe(last);
      last = it.wordId;
      s = answerCurrent(s, guard < 4 ? bad : ok);
    }
    expect(isFinished(s)).toBe(true);
  });

  it('finishes stage sessions once every word is correct and reports progress', () => {
    let s = createSession({ mode: { type: 'stage', kind: 'meaning' }, wordIds: ids, seed: 11 });
    while (!isFinished(s)) s = answerCurrent(s, ok);
    expect(sessionProgress(s)).toEqual({ done: 10, total: 10 });
    expect(summarize(s.history).accuracy).toBe(1);
  });

  it('boss sessions mix formats and never repeat', () => {
    let s = createSession({ mode: { type: 'boss' }, wordIds: ids, seed: 2 });
    const kinds = new Set(s.queue.map((q) => q.kind));
    expect(kinds.has('typing') && kinds.has('situation')).toBe(true);
    while (!isFinished(s)) s = answerCurrent(s, bad);
    expect(s.history).toHaveLength(10);
  });
});

describe('levels and mastery', () => {
  const words = Array.from({ length: 45 }, (_, i) => word(`Wort${i}, das`, `meaning ${i}`, 'noun', i));

  it('splits into 20-word levels', () => {
    const levels = buildLevels('t', words);
    expect(levels.map((l) => l.words.length)).toEqual([20, 20, 5]);
  });

  it('opens levels 1–5 freely; level 6 needs premium and levels 1–5 passed', () => {
    const many = Array.from({ length: 140 }, (_, i) => word(`w${i}, das`, `x${i}`, 'noun', i));
    const levels = buildLevels('t', many);
    const done = Object.fromEntries(levels.slice(0, 6).map((l) => [l.key, { ...emptyLevelProgress(l.key), bossPassed: true }]));
    const upTo4 = Object.fromEntries(levels.slice(0, 4).map((l) => [l.key, { ...emptyLevelProgress(l.key), bossPassed: true }]));
    expect(isLevelUnlocked(levels, 4, {}, false)).toBe(true); // level 5: open with no progress
    expect(isLevelUnlocked(levels, 5, done, false)).toBe(false); // level 6: not paid
    expect(isLevelUnlocked(levels, 5, done, true)).toBe(true); // paid, level 5 done
    expect(isLevelUnlocked(levels, 5, upTo4, true)).toBe(false); // paid, level 5 not done
  });

  it('opens Mutprobe 1–5 freely; 6 needs premium and 1–5 passed', async () => {
    const { isChallengeUnlocked } = await import('./challenge');
    const passed = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [String(i), { attempts: 1, passed: true, best: 20, lastPlayed: 1 }]));
    expect(isChallengeUnlocked(4, {}, false)).toBe(true);
    expect(isChallengeUnlocked(5, { '0': passed['0'] }, true)).toBe(false);
    expect(isChallengeUnlocked(5, passed, false)).toBe(false);
    expect(isChallengeUnlocked(5, passed, true)).toBe(true);
  });

  it('passes the boss at 85% overall and 80% typing', () => {
    const rec = (correct: boolean, typed: boolean) => ({ wordId: 'x', kind: 'typing' as const, correct, ms: 1, limitMs: 1, typed });
    const pass = summarize([...Array(17).fill(rec(true, true)), ...Array(3).fill(rec(false, true))]);
    expect(evaluateBoss(pass).passed).toBe(true);
    const fail = summarize([...Array(16).fill(rec(true, true)), ...Array(4).fill(rec(false, true))]);
    expect(evaluateBoss(fail).passed).toBe(false);
  });

  it('requires recall testing of all words and no weak words for mastery', () => {
    const [level] = buildLevels('t', words);
    const full = summarize(level.words.map((w) => ({ wordId: w.id, kind: 'typing' as const, correct: true, ms: 1, limitMs: 10, typed: true })));
    let lp = emptyLevelProgress(level.key);
    for (const st of ['learn', 'recognize', 'reverse', 'recall', 'situations', 'boss'] as const) {
      lp = applySessionToLevel(lp, st, full, st === 'recall' ? level.words.slice(0, 10).map((w) => w.id) : [], 0);
    }
    expect(checkMastery(level, lp, {}).mastered).toBe(false);
    lp = applySessionToLevel(lp, 'situations', full, level.words.map((w) => w.id), 0);
    expect(checkMastery(level, lp, {}).mastered).toBe(true);
    const weak = { ...emptyProgress(level.words[0].id), encounters: 3, incorrect: 3 };
    expect(checkMastery(level, lp, { [weak.wordId]: weak }).weakWords).toEqual([level.words[0].id]);
  });
});

describe('questions', () => {
  const pool = [apfel, vergessen, strasse, muede, fahrkarte, ticket, word('Brot, das', 'bread', 'noun', 7), word('Haus, das', 'house', 'noun', 8)];

  it('never uses a distractor that shares a meaning', () => {
    const d = pickDistractors(fahrkarte, pool, 'meaning', createRng(1));
    expect(d.map((w) => w.id)).not.toContain(ticket.id);
    expect(d).toHaveLength(3);
  });

  it('places the right answer among shuffled options', () => {
    const q = buildQuestion(apfel, 'reverse', pool, createRng(4), { meaningLang: 'en', speedInput: 'choice' });
    expect(q.options![q.correctIndex!].wordId).toBe(apfel.id);
    expect(new Set(q.options!.map((o) => o.text)).size).toBe(4);
  });

  it('rotates situations and falls back to templates', () => {
    const w = { ...apfel, situations: ['a', 'b', 'c'] };
    expect(new Set([0, 1, 2].map((n) => pickSituation(w, n))).size).toBe(3);
    expect(templateSituations(vergessen)[0]).toContain('forget');
  });
});

describe('stats', () => {
  it('counts the daily streak', () => {
    const now = new Date(2026, 10, 1, 12).getTime();
    const d = (n: number) => localDay(now - n * 86400000);
    expect(currentStreak([d(0), d(1), d(2)], now)).toBe(3);
    expect(currentStreak([d(1), d(2)], now)).toBe(2);
    expect(currentStreak([d(2)], now)).toBe(0);
  });

  it('selects due words first, most urgent first', () => {
    const now = 10 * DAY;
    const p = (id: string, due: number, incorrect: number) => ({ ...emptyProgress(id), encounters: 4, correct: 4 - incorrect, incorrect, due, strength: 50 });
    const progress = { [apfel.id]: p(apfel.id, now - DAY, 0), [muede.id]: p(muede.id, now - DAY, 3), [strasse.id]: p(strasse.id, now + DAY, 0) };
    const sel = selectReview([apfel, muede, strasse], progress, now, 5);
    expect(sel[0].id).toBe(muede.id);
    expect(sel.map((w) => w.id)).not.toContain(strasse.id);
  });
});

describe('mutprobe', () => {
  it('has 50 fixed challenges of 20 different words, getting harder', async () => {
    const { CHALLENGES, challengeTiers } = await import('./challenge');
    expect(CHALLENGES).toHaveLength(50);
    expect(CHALLENGES.every((c) => c.length === 20)).toBe(true);
    expect(new Set(CHALLENGES.flat()).size).toBe(1000);
    expect(challengeTiers(CHALLENGES[0])).toEqual(['a1', 'a2']);
    expect(challengeTiers(CHALLENGES[49])).toEqual(['a2', 'b1', 'extra']);
  });

  it('passes with all questions answered and fewer than three mistakes', async () => {
    const { challengePassed } = await import('./challenge');
    expect(challengePassed(20, 18, 20)).toBe(true);
    expect(challengePassed(20, 17, 20)).toBe(false);
    expect(challengePassed(12, 9, 20)).toBe(false);
  });

  it('asks each word once in mixed formats', () => {
    const s = createSession({ mode: { type: 'challenge' }, wordIds: ['a', 'b', 'c', 'd', 'e'], seed: 3 });
    expect(s.queue.map((q) => q.wordId).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    const next = answerCurrent(s, { correct: false, ms: 1000, limitMs: 9000, typed: true });
    expect(next.queue).toHaveLength(4);
  });
});

describe('letter clue', () => {
  it('shows the first letter and one mark per letter, without the article', async () => {
    const { letterClue, letterCount, needsClue } = await import('./clue');
    expect(letterClue(fahrkarte)).toEqual(['F', null, null, null, null, null, null, null, null]);
    expect(letterCount(fahrkarte)).toBe(9);
    expect(needsClue(fahrkarte, [ticket])).toBe(true);
    expect(needsClue(fahrkarte, [apfel])).toBe(false);
  });
});
