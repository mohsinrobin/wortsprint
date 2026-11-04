// Minimal hash router: #/path/segments
import { useEffect, useState } from 'react';

export function navigate(path: string) {
  if (window.location.hash !== `#${path}`) window.location.hash = path;
}

/** A broken "%" in a hand-made link must not crash the app: keep the raw text. */
function decode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

export function useRoute(): string[] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decode);
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const on = () => {
      setParts(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parts;
}
