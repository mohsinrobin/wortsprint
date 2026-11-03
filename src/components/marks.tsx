// Teacher's pen marks: strokes that draw themselves like ink on paper.
// These carry the app's one signature moment, the red-pen correction.
import { m } from 'motion/react';
import type { ReactNode } from 'react';

const draw = (delay = 0, duration = 0.32) => ({
  initial: { pathLength: 0, opacity: 0 },
  animate: { pathLength: 1, opacity: 1 },
  transition: { pathLength: { delay, duration, ease: [0.65, 0, 0.35, 1] as const }, opacity: { delay, duration: 0.01 } },
});

type Tone = 'ok' | 'pen' | 'blue';
const TONE: Record<Tone, string> = { ok: 'text-ok', pen: 'text-pen', blue: 'text-blue' };

export function Tick({ tone = 'ok', size = 34 }: { tone?: Tone; size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden className={`shrink-0 ${TONE[tone]}`}>
      <m.path d="M7 21 C 11 24, 14 28, 16 32 C 20 22, 26 13, 35 6" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" {...draw()} />
    </svg>
  );
}

export function Cross({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden className="shrink-0 text-pen">
      <m.path d="M9 9 C 17 17, 24 25, 32 32" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" {...draw(0, 0.2)} />
      <m.path d="M32 8 C 24 16, 16 25, 8 33" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" {...draw(0.16, 0.2)} />
    </svg>
  );
}

/** Text with a red pen line drawn through it. */
export function Struck({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`relative inline-block ${className}`}>
      {children}
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="pointer-events-none absolute -left-[3%] top-1/2 h-3 w-[106%] -translate-y-1/2 overflow-visible text-pen" aria-hidden>
        <m.path d="M1 6 C 30 3, 65 7, 99 3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...draw(0, 0.28)} />
      </svg>
    </span>
  );
}

/** A loose hand-drawn ring around something (grades, scores). */
export function Ring({ children, tone = 'pen', delay = 0.15 }: { children: ReactNode; tone?: Tone; delay?: number }) {
  return (
    <span className="relative inline-grid place-items-center px-4 py-2">
      <svg viewBox="0 0 120 80" preserveAspectRatio="none" className={`pointer-events-none absolute inset-0 h-full w-full overflow-visible ${TONE[tone]}`} aria-hidden>
        <m.path d="M62 6 C 28 4, 6 20, 8 42 C 10 66, 46 76, 78 72 C 108 68, 118 46, 110 26 C 102 9, 78 3, 50 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" {...draw(delay, 0.55)} />
      </svg>
      {children}
    </span>
  );
}

/** Rubber stamp that lands with a thump. */
export function Stamp({ children, tone = 'pen' }: { children: ReactNode; tone?: Tone }) {
  return (
    <m.div
      initial={{ scale: 1.7, rotate: -14, opacity: 0 }}
      animate={{ scale: 1, rotate: -6, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 22, delay: 0.25 }}
      className={`hand inline-block rounded-[6px] border-[3px] border-current px-4 py-1 text-2xl font-bold ${TONE[tone]}`}
    >
      {children}
    </m.div>
  );
}

/** Strichliste: tally marks in groups of five, the way a German teacher counts. */
export function Tally({ count, max = 20 }: { count: number; max?: number }) {
  const n = Math.min(count, max);
  const groups = Math.ceil(n / 5);
  return (
    <span className="inline-flex items-center gap-2" aria-label={`${count}`}>
      {Array.from({ length: groups }, (_, g) => {
        const inGroup = Math.min(5, n - g * 5);
        return (
          <svg key={g} viewBox="0 0 34 26" width={30} height={22} aria-hidden className="text-blue">
            {Array.from({ length: Math.min(4, inGroup) }, (_, i) => (
              <m.path key={i} d={`M${5 + i * 7} 3 L ${4 + i * 7} 23`} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" {...draw(0, 0.12)} />
            ))}
            {inGroup === 5 && <m.path d="M1 19 L 31 6" className="text-pen" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" {...draw(0, 0.16)} />}
          </svg>
        );
      })}
      {count > max && <span className="hand text-lg text-blue">+{count - max}</span>}
    </span>
  );
}
