// IndexedDB persistence (via idb-keyval). Vocabulary is stored per
// collection; learning state is stored separately.
import { createStore, get, set, del, keys } from 'idb-keyval';
import type { Collection, LevelProgress, Profile, Settings, Word, WordProgress } from '../types';

// "?profile=name" keeps a separate database (e.g. for a second learner or testing).
const profileName = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('profile') : null;
const store = createStore(profileName ? `wortsprint-${profileName.replace(/[^\w-]/g, '')}` : 'wortsprint', 'kv');

export interface Snapshot {
  collections: Collection[] | undefined;
  words: Record<string, Word[]>;
  progress: Record<string, WordProgress> | undefined;
  levels: Record<string, LevelProgress> | undefined;
  settings: Partial<Settings> | undefined;
  profile: Profile | undefined;
  bundleVersions: Record<string, string> | undefined;
}

export async function loadSnapshot(): Promise<Snapshot> {
  const [collections, progress, levels, settings, profile, bundleVersions] = await Promise.all([
    get<Collection[]>('collections', store),
    get<Record<string, WordProgress>>('progress', store),
    get<Record<string, LevelProgress>>('levels', store),
    get<Partial<Settings>>('settings', store),
    get<Profile>('profile', store),
    get<Record<string, string>>('bundleVersions', store),
  ]);
  const words: Record<string, Word[]> = {};
  for (const c of collections ?? []) words[c.id] = (await get<Word[]>(`words:${c.id}`, store)) ?? [];
  return { collections, words, progress, levels, settings, profile, bundleVersions };
}

export const saveCollections = (c: Collection[]) => set('collections', c, store);
export const saveWords = (id: string, w: Word[]) => set(`words:${id}`, w, store);
export const deleteWords = (id: string) => del(`words:${id}`, store);
export const saveProgress = (p: Record<string, WordProgress>) => set('progress', p, store);
export const saveLevels = (l: Record<string, LevelProgress>) => set('levels', l, store);
export const saveSettings = (s: Settings) => set('settings', s, store);
export const saveProfile = (p: Profile) => set('profile', p, store);
export const saveBundleVersions = (v: Record<string, string>) => set('bundleVersions', v, store);

export async function clearAll(): Promise<void> {
  for (const k of await keys(store)) await del(k, store);
}

export interface BundleInfo {
  id: string;
  name: string;
  description: string;
  count: number;
  version: string;
}

export async function fetchBundleIndex(): Promise<BundleInfo[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}collections/index.json`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchBundle(id: string): Promise<Word[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}collections/${id}.json`);
  if (!res.ok) throw new Error(`Could not load ${id}`);
  return res.json();
}
