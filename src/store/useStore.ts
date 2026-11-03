// App state: vocabulary database + learning state, persisted to IndexedDB.
import { create } from 'zustand';
import type { Collection, LevelProgress, Profile, QuestionKind, Settings, StageId, Word, WordProgress } from '../types';
import type { ParsedEntry } from '../data/parse';
import { slugify } from '../data/parse';
import * as db from '../store/db';
import { applyOutcome, emptyProgress, memoryState, type Outcome } from '../engine/srs';
import { applySessionToLevel, buildLevels, checkMastery, emptyLevelProgress, evaluateBoss } from '../engine/levels';
import type { SessionMode, SessionSummary } from '../engine/session';
import { currentStreak, localDay, newBadges, overview } from '../engine/stats';

export const DEFAULT_SETTINGS: Settings = {
  uiLang: 'en',
  meaningLang: 'en',
  timers: { meaning: 8, reverse: 7, typing: 12, situation: 15, speed: 5 },
  difficulty: 'normal',
  reviewSize: 25,
  sound: true,
  typo: 'lenient',
  retryGap: 'later',
  practiceScope: 'all',
  selectedLevels: [],
  showSituationHint: false,
  speedInput: 'choice',
};

const EMPTY_PROFILE: Profile = {
  xp: 0,
  practiceDays: [],
  badges: [],
  sessions: 0,
  totalAnswers: 0,
  totalCorrect: 0,
  totalMs: 0,
  recent: [],
};

export interface PlayConfig {
  title: string;
  mode: SessionMode;
  wordIds: string[];
  levelKey?: string;
  stage?: StageId;
  extra?: string[];
  /** Where "back" goes after the session. */
  returnTo: string;
}

export interface FinishInput {
  config: PlayConfig;
  summary: SessionSummary;
  xp: number;
  recallWordIds: string[];
  speedScore?: number;
  maxCombo?: number;
}

export interface FinishResult {
  badges: string[];
  bossPassed?: boolean;
}

interface State {
  ready: boolean;
  collections: Collection[];
  words: Record<string, Word[]>;
  progress: Record<string, WordProgress>;
  levels: Record<string, LevelProgress>;
  settings: Settings;
  profile: Profile;
  play: PlayConfig | null;

  init: () => Promise<void>;
  wordById: (id: string) => Word | undefined;
  allWords: () => Word[];

  importEntries: (target: { collectionId?: string; name?: string }, entries: ParsedEntry[]) => Promise<{ collectionId: string; added: number }>;
  addBundled: (id: string) => Promise<void>;
  addWord: (collectionId: string, entry: ParsedEntry) => void;
  updateWord: (word: Word) => void;
  deleteWord: (word: Word) => void;
  renameCollection: (id: string, name: string) => void;
  deleteCollection: (id: string) => Promise<void>;

  recordAnswer: (wordId: string, outcome: Outcome) => void;
  finishSession: (input: FinishInput) => FinishResult;
  startPlay: (config: PlayConfig) => void;

  updateSettings: (patch: Partial<Settings>) => void;
  exportBackup: () => string;
  importBackup: (json: string) => Promise<void>;
  resetProgress: () => Promise<void>;
}

// --- persistence helpers -------------------------------------------------

const timers: Record<string, ReturnType<typeof setTimeout>> = {};
function debounce(key: string, fn: () => void, ms = 400) {
  clearTimeout(timers[key]);
  timers[key] = setTimeout(fn, ms);
}

function mergeBundledSituations(stored: Word[], fresh: Word[]): Word[] {
  const byId = new Map(fresh.map((w) => [w.id, w]));
  return stored.map((w) => {
    const f = byId.get(w.id);
    return f?.situations?.length && !w.situations?.length ? { ...w, situations: f.situations } : w;
  });
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function entryToWord(e: ParsedEntry, collectionId: string, order: number): Word {
  return { ...e, id: `${collectionId}-${slugify(e.lemma)}-${uid('w').slice(-5)}`, collectionId, order };
}

let indexCache: { src: Record<string, Word[]>; map: Map<string, Word> } | null = null;
function wordIndex(words: Record<string, Word[]>): Map<string, Word> {
  if (indexCache?.src !== words) indexCache = { src: words, map: new Map(Object.values(words).flat().map((w) => [w.id, w])) };
  return indexCache.map;
}

const keyOf = (w: { de: string; en: string }) => `${w.de.toLowerCase()}|${w.en.toLowerCase()}`;

export const useStore = create<State>((set, get) => {
  const persist = {
    collections: () => debounce('collections', () => db.saveCollections(get().collections)),
    words: (id: string) => debounce(`words:${id}`, () => db.saveWords(id, get().words[id] ?? [])),
    progress: () => debounce('progress', () => db.saveProgress(get().progress), 600),
    levels: () => debounce('levels', () => db.saveLevels(get().levels)),
    settings: () => debounce('settings', () => db.saveSettings(get().settings)),
    profile: () => debounce('profile', () => db.saveProfile(get().profile)),
  };

  const setWords = (id: string, list: Word[]) => {
    set((s) => ({ words: { ...s.words, [id]: list } }));
    persist.words(id);
  };

  return {
    ready: false,
    collections: [],
    words: {},
    progress: {},
    levels: {},
    settings: DEFAULT_SETTINGS,
    profile: EMPTY_PROFILE,
    play: null,

    async init() {
      const snap = await db.loadSnapshot();
      let collections = snap.collections ?? [];
      const words = snap.words;
      const versions = { ...(snap.bundleVersions ?? {}) };
      const bundles = await db.fetchBundleIndex().catch(() => []);

      if (!snap.collections) {
        // First run: install the bundled lists.
        for (const b of bundles) {
          words[b.id] = await db.fetchBundle(b.id);
          versions[b.id] = b.version;
          collections.push({ id: b.id, name: b.name, description: b.description, createdAt: Date.now(), bundled: true });
          await db.saveWords(b.id, words[b.id]);
        }
        await db.saveCollections(collections);
      } else {
        // A bundled list the user no longer has (deleting was possible in
        // early test builds) comes back, with its progress untouched.
        for (const b of bundles) {
          if (collections.some((c) => c.id === b.id)) continue;
          words[b.id] = words[b.id]?.length ? words[b.id] : await db.fetchBundle(b.id);
          versions[b.id] = b.version;
          collections = [...collections, { id: b.id, name: b.name, description: b.description, createdAt: Date.now(), bundled: true }];
          await db.saveWords(b.id, words[b.id]);
          await db.saveCollections(collections);
        }
        // Newer bundle (e.g. more situations): merge without touching edits.
        for (const b of bundles) {
          if (!words[b.id] || versions[b.id] === b.version) continue;
          words[b.id] = mergeBundledSituations(words[b.id], await db.fetchBundle(b.id));
          versions[b.id] = b.version;
          await db.saveWords(b.id, words[b.id]);
        }
      }
      await db.saveBundleVersions(versions);
      // Bundled descriptions can't be edited by the user, so keep them current.
      let renamed = false;
      collections = collections.map((c) => {
        const d = c.bundled ? bundles.find((b) => b.id === c.id)?.description : undefined;
        if (d === undefined || d === c.description) return c;
        renamed = true;
        return { ...c, description: d };
      });
      if (renamed) await db.saveCollections(collections);
      const settings = { ...DEFAULT_SETTINGS, ...snap.settings, timers: { ...DEFAULT_SETTINGS.timers, ...snap.settings?.timers } };
      // English only for now; other interface and meaning languages come later.
      settings.uiLang = 'en';
      settings.meaningLang = 'en';
      // Older saves kept normal timers and scaled them by difficulty at play time;
      // write the difficulty's own timers so play time stays the same.
      const normal = DIFFICULTY_TIMERS.normal;
      if (settings.difficulty !== 'normal' && (Object.keys(normal) as QuestionKind[]).every((k) => settings.timers[k] === normal[k])) {
        settings.timers = { ...DIFFICULTY_TIMERS[settings.difficulty] };
      }
      set({
        ready: true,
        collections,
        words,
        progress: snap.progress ?? {},
        levels: snap.levels ?? {},
        settings,
        profile: { ...EMPTY_PROFILE, ...snap.profile },
      });
    },

    wordById(id) {
      return wordIndex(get().words).get(id);
    },

    allWords() {
      return Object.values(get().words).flat();
    },

    async importEntries(target, entries) {
      let collectionId = target.collectionId;
      if (!collectionId) {
        collectionId = uid('c');
        const c: Collection = { id: collectionId, name: target.name?.trim() || 'My words', createdAt: Date.now() };
        set((s) => ({ collections: [...s.collections, c] }));
        persist.collections();
      }
      const existing = get().words[collectionId] ?? [];
      const seen = new Set(existing.map(keyOf));
      let order = existing.reduce((m, w) => Math.max(m, w.order), -1) + 1;
      const fresh: Word[] = [];
      for (const e of entries) {
        if (seen.has(keyOf(e))) continue;
        seen.add(keyOf(e));
        fresh.push(entryToWord(e, collectionId, order++));
      }
      setWords(collectionId, [...existing, ...fresh]);
      return { collectionId, added: fresh.length };
    },

    async addBundled(id) {
      const index = await db.fetchBundleIndex();
      const b = index.find((x) => x.id === id);
      if (!b || get().collections.some((c) => c.id === id)) return;
      const list = await db.fetchBundle(id);
      set((s) => ({
        collections: [...s.collections, { id, name: b.name, description: b.description, createdAt: Date.now(), bundled: true }],
      }));
      persist.collections();
      setWords(id, list);
    },

    addWord(collectionId, entry) {
      const list = get().words[collectionId] ?? [];
      const order = list.reduce((m, w) => Math.max(m, w.order), -1) + 1;
      setWords(collectionId, [...list, entryToWord(entry, collectionId, order)]);
    },

    updateWord(word) {
      const list = get().words[word.collectionId] ?? [];
      setWords(word.collectionId, list.map((w) => (w.id === word.id ? word : w)));
    },

    deleteWord(word) {
      const list = get().words[word.collectionId] ?? [];
      setWords(word.collectionId, list.filter((w) => w.id !== word.id));
      set((s) => {
        const progress = { ...s.progress };
        delete progress[word.id];
        return { progress };
      });
      persist.progress();
    },

    renameCollection(id, name) {
      set((s) => ({ collections: s.collections.map((c) => (c.id === id ? { ...c, name } : c)) }));
      persist.collections();
    },

    async deleteCollection(id) {
      const ids = new Set((get().words[id] ?? []).map((w) => w.id));
      set((s) => {
        const words = { ...s.words };
        delete words[id];
        const progress = Object.fromEntries(Object.entries(s.progress).filter(([k]) => !ids.has(k)));
        const levels = Object.fromEntries(Object.entries(s.levels).filter(([k]) => !k.startsWith(`${id}:`)));
        return { collections: s.collections.filter((c) => c.id !== id), words, progress, levels };
      });
      await db.deleteWords(id);
      persist.collections();
      persist.progress();
      persist.levels();
    },

    recordAnswer(wordId, outcome) {
      const now = Date.now();
      set((s) => ({
        progress: { ...s.progress, [wordId]: applyOutcome(s.progress[wordId] ?? emptyProgress(wordId), outcome, now) },
      }));
      persist.progress();
    },

    finishSession({ config, summary, xp, recallWordIds, speedScore, maxCombo }) {
      const now = Date.now();
      const s = get();
      let levels = s.levels;
      let bossPassed: boolean | undefined;

      if (config.levelKey && config.stage) {
        const prev = s.levels[config.levelKey] ?? emptyLevelProgress(config.levelKey);
        let lp = applySessionToLevel(prev, config.stage, summary, recallWordIds, now);
        const [cid, idx] = config.levelKey.split(':');
        const level = buildLevels(cid, s.words[cid] ?? [])[Number(idx)];
        if (level) lp = { ...lp, mastered: checkMastery(level, lp, s.progress).mastered };
        if (config.stage === 'boss') bossPassed = evaluateBoss(summary).passed;
        levels = { ...levels, [config.levelKey]: lp };
      } else if (config.levelKey) {
        // Weak-word review of a level can complete mastery.
        const [cid, idx] = config.levelKey.split(':');
        const level = buildLevels(cid, s.words[cid] ?? [])[Number(idx)];
        const lp = s.levels[config.levelKey];
        if (level && lp) levels = { ...levels, [config.levelKey]: { ...lp, mastered: checkMastery(level, lp, s.progress).mastered } };
      }

      const day = localDay(now);
      const profile: Profile = {
        ...s.profile,
        xp: s.profile.xp + xp,
        practiceDays: s.profile.practiceDays.includes(day) ? s.profile.practiceDays : [...s.profile.practiceDays, day].slice(-400),
        sessions: s.profile.sessions + 1,
        totalAnswers: s.profile.totalAnswers + summary.answered,
        totalCorrect: s.profile.totalCorrect + summary.correct,
        totalMs: s.profile.totalMs + summary.avgMs * summary.correct,
        recent: [{ at: now, title: config.title, accuracy: summary.accuracy, answered: summary.answered, xp }, ...s.profile.recent].slice(0, 12),
      };
      const ov = overview(s.allWords(), s.progress, now);
      const earned = newBadges({
        profile,
        streak: currentStreak(profile.practiceDays, now),
        mastered: ov.mastered,
        levelsPassed: Object.values(levels).filter((l) => l.bossPassed).length,
        lastSession: { accuracy: summary.accuracy, answered: summary.answered, speedScore, maxCombo },
      });
      profile.badges = [...profile.badges, ...earned];
      set({ levels, profile });
      persist.levels();
      persist.profile();
      return { badges: earned, bossPassed };
    },

    startPlay(config) {
      set({ play: config });
    },

    updateSettings(patch) {
      set((s) => ({ settings: { ...s.settings, ...patch } }));
      persist.settings();
    },

    exportBackup() {
      const s = get();
      return JSON.stringify(
        {
          app: 'wortsprint',
          version: 1,
          exportedAt: new Date().toISOString(),
          collections: s.collections,
          words: s.words,
          progress: s.progress,
          levels: s.levels,
          settings: s.settings,
          profile: s.profile,
        },
        null,
        1,
      );
    },

    async importBackup(json) {
      const data = JSON.parse(json);
      if (data?.app !== 'wortsprint' || !Array.isArray(data.collections) || typeof data.words !== 'object') {
        throw new Error('This file is not a WortSprint backup.');
      }
      await db.clearAll();
      for (const c of data.collections as Collection[]) await db.saveWords(c.id, data.words[c.id] ?? []);
      await db.saveCollections(data.collections);
      await db.saveProgress(data.progress ?? {});
      await db.saveLevels(data.levels ?? {});
      await db.saveSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      await db.saveProfile({ ...EMPTY_PROFILE, ...data.profile });
      await db.saveBundleVersions({});
      await get().init();
    },

    async resetProgress() {
      set({ progress: {}, levels: {}, profile: EMPTY_PROFILE });
      await Promise.all([db.saveProgress({}), db.saveLevels({}), db.saveProfile(EMPTY_PROFILE)]);
    },
  };
});

// --- derived helpers used by screens ------------------------------------

/** Timer seconds each difficulty sets; the user can fine-tune them afterwards. */
export const DIFFICULTY_TIMERS: Record<Settings['difficulty'], Settings['timers']> = {
  easy: { meaning: 12, reverse: 11, typing: 18, situation: 23, speed: 8 },
  normal: { meaning: 8, reverse: 7, typing: 12, situation: 15, speed: 5 },
  hard: { meaning: 6, reverse: 5, typing: 9, situation: 11, speed: 4 },
  extreme: { meaning: 4, reverse: 4, typing: 7, situation: 8, speed: 3 },
};

export function timeLimitMs(settings: Settings, kind: QuestionKind, boss = false): number {
  const base = settings.timers[kind] * 1000;
  return Math.round(boss ? base * 0.85 : base);
}

export function weakIn(words: Word[], progress: Record<string, WordProgress>): Word[] {
  return words.filter((w) => memoryState(progress[w.id]) === 'weak');
}
