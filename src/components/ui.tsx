import type { ReactNode } from 'react';
import { ArrowLeft } from '@phosphor-icons/react';
import type { MemoryState } from '../types';
import { useT } from '../lib/i18n';

export const STATE_COLOR: Record<MemoryState, string> = {
  new: 'bg-line',
  learning: 'bg-blue/45',
  weak: 'bg-pen',
  familiar: 'bg-marker',
  strong: 'bg-ok',
  mastered: 'bg-blue',
};

export const STATE_TEXT: Record<MemoryState, string> = {
  new: 'text-pencil bg-paper border-line',
  learning: 'text-blue bg-blue-soft border-blue/25',
  weak: 'text-pen bg-pen-soft border-pen/30',
  familiar: 'text-gold bg-gold-soft border-gold/25',
  strong: 'text-ok bg-ok-soft border-ok/30',
  mastered: 'text-onblue bg-blue border-blue',
};

export function StateBadge({ state }: { state: MemoryState }) {
  const t = useT();
  return (
    <span className={`inline-flex shrink-0 items-center rounded-[4px] border px-1.5 py-px text-xs font-semibold ${STATE_TEXT[state]}`}>
      {t(`state_${state}`)}
    </span>
  );
}

export function ProgressBar({ value, className = '', color = 'bg-blue' }: { value: number; className?: string; color?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-line/60 ${className}`}>
      <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${color}`} style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}

export function PageHeader({ title, subtitle, back, right }: { title: ReactNode; subtitle?: ReactNode; back?: () => void; right?: ReactNode }) {
  const t = useT();
  return (
    <div className="mb-6 flex items-center gap-3">
      {back && (
        <button onClick={back} className="btn-ghost h-10 w-10 shrink-0 !p-0" aria-label={t('back')}>
          <ArrowLeft size={18} weight="bold" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[28px] font-semibold leading-tight sm:text-[32px]">{title}</h1>
        {subtitle && <p className="truncate text-[15px] text-pencil">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-sheet border border-line bg-paper p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 whitespace-nowrap rounded-[4px] px-3 py-1.5 text-sm font-semibold transition-colors ${
            value === o.value ? 'bg-blue text-onblue shadow-sm' : 'text-pencil hover:text-ink'
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
      <span className="text-[15px]">{label}</span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-blue' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-sheet shadow-sm transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-sheet border border-dashed border-pencil/40 bg-sheet/70 p-6 text-center text-[15px] text-pencil">{children}</div>;
}

export function articleColor(article?: string): string {
  return article === 'der' ? 'text-der' : article === 'die' ? 'text-die' : article === 'das' ? 'text-das' : '';
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

/** German school grade (1 = sehr gut … 6 = ungenügend) from an accuracy 0–1. */
export function gradeFor(accuracy: number): { grade: number; word: string } {
  const g = accuracy >= 0.92 ? 1 : accuracy >= 0.81 ? 2 : accuracy >= 0.67 ? 3 : accuracy >= 0.5 ? 4 : accuracy >= 0.3 ? 5 : 6;
  return { grade: g, word: ['sehr gut', 'gut', 'befriedigend', 'ausreichend', 'mangelhaft', 'ungenügend'][g - 1] };
}
