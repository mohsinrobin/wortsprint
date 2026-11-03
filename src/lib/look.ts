// Design themes. Each is a complete visual world (fonts, palette, Home hero,
// Library cards, logo) on the same app. The choice is per device, like
// light/dark; `?look=` in the URL also sets it.
import { useSyncExternalStore } from 'react';

export const LOOKS = ['heft', 'bahn'] as const;
export type Look = (typeof LOOKS)[number];
export const LOOK_NAME: Record<Look, string> = {
  heft: 'Schulheft',
  bahn: 'Fahrplan',
};

const KEY = 'ws-look';
const listeners = new Set<() => void>();
const isLook = (v: unknown): v is Look => LOOKS.includes(v as Look);

export function getLook(): Look {
  try {
    const v = localStorage.getItem(KEY);
    return isLook(v) ? v : 'heft';
  } catch {
    return 'heft';
  }
}

export function setLook(look: Look) {
  try {
    localStorage.setItem(KEY, look);
  } catch {
    // Storage blocked: lasts for this visit only.
  }
  document.documentElement.dataset.look = look;
  listeners.forEach((l) => l());
}

if (typeof location !== 'undefined') {
  const fromUrl = new URLSearchParams(location.search).get('look');
  if (isLook(fromUrl)) setLook(fromUrl);
  else document.documentElement.dataset.look = getLook();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useLook(): Look {
  return useSyncExternalStore(subscribe, getLook);
}
