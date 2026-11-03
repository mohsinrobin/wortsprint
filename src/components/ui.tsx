import type { ReactNode } from 'react';
import type { MemoryState } from '../types';
import { useT } from '../lib/i18n';

export const STATE_COLOR: Record<MemoryState, string> = {
  new: 'bg-slate-500',
  learning: 'bg-sky-400',
  weak: 'bg-red-400',
  familiar: 'bg-amber-300',
  strong: 'bg-emerald-400',
  mastered: 'bg-violet-400',
};

export const STATE_TEXT: Record<MemoryState, string> = {
  new: 'text-slate-300 bg-slate-500/15 border-slate-500/30',
  learning: 'text-sky-300 bg-sky-400/10 border-sky-400/30',
  weak: 'text-red-300 bg-red-400/10 border-red-400/30',
  familiar: 'text-amber-200 bg-amber-300/10 border-amber-300/30',
  strong: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30',
  mastered: 'text-violet-300 bg-violet-400/10 border-violet-400/30',
};

export function StateBadge({ state }: { state: MemoryState }) {
  const t = useT();
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATE_TEXT[state]}`}>
      {t(`state_${state}`)}
    </span>
  );
}

export function ProgressBar({ value, className = '', color = 'bg-emerald-400' }: { value: number; className?: string; color?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-white/5 ${className}`}>
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}

export function Stat({ label, value, hint, accent = 'text-[var(--ink)]' }: { label: string; value: ReactNode; hint?: string; accent?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-[var(--muted)]">{hint}</div>}
    </div>
  );
}

export function PageHeader({ title, back, right }: { title: ReactNode; back?: () => void; right?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      {back && (
        <button onClick={back} className="btn-ghost h-9 w-9 shrink-0 !p-0" aria-label="Back">
          ←
        </button>
      )}
      <h1 className="min-w-0 flex-1 truncate text-xl font-bold sm:text-2xl">{title}</h1>
      {right}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            value === o.value ? 'bg-emerald-400 text-[#06281c]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 py-1 text-left" role="switch" aria-checked={checked}>
      <span className="text-sm">{label}</span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-emerald-400' : 'bg-slate-600'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-[var(--line)] p-6 text-center text-sm text-[var(--muted)]">{children}</div>;
}

export function articleColor(article?: string): string {
  return article === 'der' ? 'text-sky-300' : article === 'die' ? 'text-rose-300' : article === 'das' ? 'text-emerald-300' : '';
}

/** "der Apfel" with the article tinted by gender. */
export function GermanWord({ de, article, className = '' }: { de: string; article?: string; className?: string }) {
  if (!article || !de.startsWith(article + ' ')) return <span className={className}>{de}</span>;
  return (
    <span className={className}>
      <span className={articleColor(article)}>{article}</span> {de.slice(article.length + 1)}
    </span>
  );
}
