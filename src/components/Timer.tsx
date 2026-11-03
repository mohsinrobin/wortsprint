// Countdown ring driven by requestAnimationFrame. Reports elapsed time and timeouts.
import { useEffect, useRef, useState } from 'react';

interface Props {
  limitMs: number;
  running: boolean;
  /** Changing the key restarts the timer. */
  resetKey: string | number;
  onTimeout: () => void;
  onTick?: (secondsLeft: number) => void;
  elapsedRef: React.MutableRefObject<number>;
}

export function Timer({ limitMs, running, resetKey, onTimeout, onTick, elapsedRef }: Props) {
  const [left, setLeft] = useState(limitMs);
  const startRef = useRef(0);
  const accRef = useRef(0);
  const firedRef = useRef(false);
  const lastSecRef = useRef(-1);
  const cb = useRef({ onTimeout, onTick });
  cb.current = { onTimeout, onTick };

  useEffect(() => {
    accRef.current = 0;
    firedRef.current = false;
    lastSecRef.current = -1;
    elapsedRef.current = 0;
    setLeft(limitMs);
  }, [resetKey, limitMs, elapsedRef]);

  useEffect(() => {
    if (!running) return;
    startRef.current = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const elapsed = accRef.current + (now - startRef.current);
      elapsedRef.current = elapsed;
      const remaining = Math.max(0, limitMs - elapsed);
      setLeft(remaining);
      const sec = Math.ceil(remaining / 1000);
      if (sec !== lastSecRef.current) {
        lastSecRef.current = sec;
        cb.current.onTick?.(sec);
      }
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        cb.current.onTimeout();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      accRef.current += performance.now() - startRef.current;
    };
  }, [running, resetKey, limitMs, elapsedRef]);

  const frac = limitMs ? left / limitMs : 0;
  const r = 20;
  const c = 2 * Math.PI * r;
  const color = frac > 0.5 ? '#34d399' : frac > 0.25 ? '#fcd34d' : '#f87171';
  return (
    <div className="relative h-12 w-12 shrink-0" aria-label={`${Math.ceil(left / 1000)} seconds left`}>
      <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums" style={{ color }}>
        {Math.ceil(left / 1000)}
      </span>
    </div>
  );
}
