// Light / dark theme. The choice is a per-device preference, kept in
// localStorage so index.html can apply it before the first paint.
import { useSyncExternalStore } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'ws-theme';
const media = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
const listeners = new Set<() => void>();

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function resolvedTheme(pref = getThemePref()): 'light' | 'dark' {
  return pref === 'system' ? (media?.matches ? 'dark' : 'light') : pref;
}

function apply() {
  const theme = resolvedTheme();
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0F121B' : '#EEEFEA');
  listeners.forEach((l) => l());
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // Storage blocked (private mode): the choice lasts for this visit only.
  }
  apply();
}

media?.addEventListener('change', () => getThemePref() === 'system' && apply());
if (typeof document !== 'undefined') apply();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useTheme(): { pref: ThemePref; theme: 'light' | 'dark' } {
  const pref = useSyncExternalStore(subscribe, getThemePref);
  const theme = useSyncExternalStore(subscribe, () => resolvedTheme());
  return { pref, theme };
}
