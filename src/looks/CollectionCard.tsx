// A collection in the Library, drawn in each theme's own world.
import { ProgressBar } from '../components/ui';
import { useT } from '../lib/i18n';
import { useLook } from '../lib/look';
import type { Collection } from '../types';

export interface CollectionCardProps {
  c: Collection;
  index: number;
  words: number;
  levels: number;
  learned: number;
  mastered: number;
  onOpen: () => void;
}

/** Short badge for a collection: its CEFR level if the name has one. */
/** Yellow covers need dark text to stay readable. */
const badgeText = (i: number) => (i % 6 === 3 ? 'text-ink' : 'text-white');
const badge = (name: string) => name.match(/\b([ABC][12])\b/)?.[1] ?? name.slice(0, 2).toUpperCase();

export function CollectionCard(p: CollectionCardProps) {
  const look = useLook();
  const t = useT();
  const frac = p.learned / Math.max(1, p.words);
  const stats = (
    <span className="flex flex-wrap gap-x-3 text-sm text-pencil">
      <span>
        <b className="text-ink">{p.words}</b> {t('words')}
      </span>
      <span>
        <b className="text-ink">{p.levels}</b> {t('levels')}
      </span>
      <span>
        <b className="text-ink">{p.learned}</b> {t('learned').toLowerCase()}
      </span>
    </span>
  );

  if (look === 'bahn') {
    // A line on the network map: coloured line badge, route progress.
    return (
      <button onClick={p.onOpen} className="card flex w-full items-center gap-4 p-4 text-left transition-shadow hover:shadow-lift">
        <span className={`grid h-12 w-14 shrink-0 place-items-center rounded-[6px] text-[20px] font-bold ${badgeText(p.index)}`} style={{ background: `rgb(var(--cover-${(p.index % 6) + 1}))` }}>
          {badge(p.c.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[18px] font-semibold">{p.c.name}</span>
          {stats}
          <ProgressBar value={frac} className="mt-2" />
        </span>
      </button>
    );
  }

  // Schulheft: an exercise book with a coloured cover and a white name label.
  return (
    <button onClick={p.onOpen} className="group w-full rounded-sheet p-4 text-left shadow-sheet transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lift sm:p-5" style={{ background: `rgb(var(--cover-${(p.index % 6) + 1}))` }}>
      <span className="block rounded-[3px] bg-sheet px-4 pb-3 pt-2 shadow-sm">
        <span className="hand block border-b border-line pb-0.5 text-2xl font-bold text-blue">{p.c.name}</span>
        {p.c.description && <span className="block border-b border-line py-1 text-sm text-pencil">{p.c.description}</span>}
        <span className="block pt-1.5">{stats}</span>
        <ProgressBar value={frac} className="mt-2" />
      </span>
    </button>
  );
}
