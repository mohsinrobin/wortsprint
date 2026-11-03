// Shared domain types. The vocabulary database (Word, Collection) is kept
// separate from learning state (WordProgress, LevelProgress) so the game
// engine never mutates vocabulary.

export type Pos = 'noun' | 'verb' | 'adjective' | 'adverb' | 'pronoun' | 'other';
export type Article = 'der' | 'die' | 'das';

export interface Word {
  id: string;
  collectionId: string;
  /** Display form, e.g. "der Apfel" or "sich freuen". */
  de: string;
  /** Main form without article, e.g. "Apfel". */
  lemma: string;
  article?: Article;
  /** Every accepted typed answer (with article for nouns). */
  variants: string[];
  pos: Pos;
  /** English meaning(s), comma separated. */
  en: string;
  /** Bengali meaning(s), optional. */
  bn?: string;
  /** Hand-written real-life situations (English). */
  situations?: string[];
  /** Position inside the collection; defines level membership. */
  order: number;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  bundled?: boolean;
}

export type MemoryState = 'new' | 'learning' | 'weak' | 'familiar' | 'strong' | 'mastered';

/** Question formats, in the order a word climbs through them. */
export type QuestionKind = 'meaning' | 'reverse' | 'typing' | 'situation' | 'speed';

export interface WordProgress {
  wordId: string;
  encounters: number;
  correct: number;
  incorrect: number;
  typingAttempts: number;
  typingCorrect: number;
  /** Running average response time in ms (correct answers only). */
  avgMs: number;
  lastSeen: number;
  streak: number;
  /** Times this word has been answered wrong after once being strong/mastered, plus raw misses. */
  lapses: number;
  /** 0..100 memory strength. */
  strength: number;
  /** Index into the spaced repetition interval ladder. */
  box: number;
  /** Timestamp the word is next due for review (0 = not scheduled yet). */
  due: number;
  /** Highest question format the word has been answered correctly in (0..4). */
  ladder: number;
}

export type StageId = 'learn' | 'recognize' | 'reverse' | 'recall' | 'situations' | 'boss';

export interface StageResult {
  done: boolean;
  attempts: number;
  correct: number;
  bestAccuracy: number;
}

export interface LevelProgress {
  /** `${collectionId}:${levelIndex}` */
  key: string;
  stages: Partial<Record<StageId, StageResult>>;
  bossPassed: boolean;
  mastered: boolean;
  /** Overall first-try accuracy across all staged questions of the level. */
  attempts: number;
  correct: number;
  typingAttempts: number;
  typingCorrect: number;
  /** Word ids tested at least once in a typing format (recall/situation). */
  recallTested: string[];
  lastPlayed: number;
}

export type Difficulty = 'easy' | 'normal' | 'hard' | 'extreme';
export type TypoTolerance = 'off' | 'strict' | 'lenient';

export interface Settings {
  uiLang: 'en' | 'bn';
  meaningLang: 'en' | 'bn';
  timers: Record<QuestionKind, number>;
  difficulty: Difficulty;
  reviewSize: number;
  sound: boolean;
  typo: TypoTolerance;
  /** Gap (in questions) before a missed word comes back. 1 = immediately. */
  retryGap: 'immediate' | 'later';
  practiceScope: 'all' | 'selected';
  selectedLevels: string[];
  showSituationHint: boolean;
  speedInput: 'choice' | 'typing';
}

export interface Profile {
  xp: number;
  /** Local date strings (YYYY-MM-DD) with at least one completed session. */
  practiceDays: string[];
  badges: string[];
  sessions: number;
  totalAnswers: number;
  totalCorrect: number;
  totalMs: number;
  recent: RecentSession[];
}

export interface RecentSession {
  at: number;
  title: string;
  accuracy: number;
  answered: number;
  xp: number;
}
