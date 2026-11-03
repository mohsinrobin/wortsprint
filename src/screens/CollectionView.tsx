import { CheckSquare, Crown, Lock, MagnifyingGlass, Play, SealCheck, Square } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import type { Word } from '../types';
import { useStore } from '../store/useStore';
import { navigate } from '../lib/router';
import { useT } from '../lib/i18n';
import { PageHeader, StateBadge, GermanWord, Empty } from '../components/ui';
import { buildLevels, isLevelUnlocked, STAGES, checkMastery } from '../engine/levels';
import { memoryState } from '../engine/srs';
import { fullMeaning } from '../engine/questions';
import { ladderPlay } from '../play/configs';

export function CollectionView({ collectionId }: { collectionId: string }) {
  const t = useT();
  const collection = useStore((s) => s.collections.find((c) => c.id === collectionId));
  const words = useStore((s) => s.words[collectionId]);
  const progress = useStore((s) => s.progress);
  const levelProgress = useStore((s) => s.levels);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const startPlay = useStore((s) => s.startPlay);
  const [tab, setTab] = useState<'levels' | 'words'>('levels');
  const [selecting, setSelecting] = useState(false);

  const levels = useMemo(() => buildLevels(collectionId, words ?? []), [collectionId, words]);
  if (!collection) {
    return (
      <div>
        <PageHeader title="—" back={() => navigate('/library')} />
        <Empty>Collection not found.</Empty>
      </div>
    );
  }

  const selected = new Set(settings.selectedLevels);
  const toggleSelected = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    updateSettings({ selectedLevels: [...next] });
  };
  const practiceSelected = () => {
    const ws = levels.filter((l) => selected.has(l.key)).flatMap((l) => l.words);
    if (!ws.length) return;
    const pick = [...ws].sort((a, b) => (progress[a.id]?.strength ?? 0) - (progress[b.id]?.strength ?? 0)).slice(0, settings.reviewSize);
    startPlay(ladderPlay(`${collection.name}: ${t('practiceSelected')}`, pick, `/c/${encodeURIComponent(collectionId)}`));
    navigate('/play');
  };

  return (
    <div>
      <PageHeader
        title={collection.name}
        back={() => navigate('/library')}
        subtitle={collection.description}
      />
      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        {(['levels', 'words'] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`relative whitespace-nowrap px-1 py-1.5 text-[15px] font-semibold ${tab === k ? 'text-ink after:absolute after:inset-x-0 after:-bottom-0.5 after:h-[3px] after:rounded-full after:bg-blue' : 'text-pencil hover:text-ink'}`}>
            {k === 'levels' ? `${levels.length} ${t('levels')}` : `${words?.length ?? 0} ${t('words')}`}
          </button>
        ))}
        {tab === 'levels' && (
          <div className="ml-auto flex gap-2">
            {selecting && selected.size > 0 && (
              <button className="btn-primary whitespace-nowrap !px-3 !py-1.5 text-sm" onClick={practiceSelected}>
                <Play size={16} weight="fill" /> {t('practiceSelected')} ({[...selected].filter((k) => k.startsWith(`${collectionId}:`)).length})
              </button>
            )}
            <button className="btn-ghost whitespace-nowrap !px-3 !py-1.5 text-sm" onClick={() => setSelecting((s) => !s)}>
              {selecting ? <CheckSquare size={18} weight="fill" /> : <Square size={18} weight="bold" />} {t('practiceSelected')}
            </button>
          </div>
        )}
      </div>

      {tab === 'levels' ? (
        levels.length === 0 ? (
          <Empty>{t('importHelp')}</Empty>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {levels.map((l) => {
              const lp = levelProgress[l.key];
              const unlocked = isLevelUnlocked(levels, l.index, levelProgress);
              const mastered = lp?.mastered || (lp?.bossPassed && checkMastery(l, lp, progress).mastered);
              const states = l.words.map((w) => memoryState(progress[w.id]));
              const strong = states.filter((s) => s === 'strong' || s === 'mastered').length;
              const isSel = selected.has(l.key);
              return (
                <button
                  key={l.key}
                  onClick={() => (selecting ? toggleSelected(l.key) : unlocked && navigate(`/c/${encodeURIComponent(collectionId)}/l/${l.index}`))}
                  className={`card relative p-4 text-left transition ${unlocked || selecting ? 'hover:border-pencil' : 'cursor-not-allowed opacity-50'} ${isSel && selecting ? '!border-blue ring-1 ring-blue' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="text-sm font-medium text-pencil">{t('level')}</div>
                    {selecting ? (
                      <span className={isSel ? 'text-blue' : 'text-pencil'}>{isSel ? <CheckSquare size={20} weight="fill" /> : <Square size={20} weight="bold" />}</span>
                    ) : mastered ? (
                      <Crown size={20} weight="fill" className="text-gold" aria-label={t('levelMastered')} />
                    ) : lp?.bossPassed ? (
                      <SealCheck size={20} weight="fill" className="text-ok" aria-label={t('levelPassed')} />
                    ) : !unlocked ? (
                      <Lock size={18} weight="bold" className="text-pencil" aria-label={t('locked')} />
                    ) : null}
                  </div>
                  <div className="hand text-[34px] font-bold leading-none text-blue">{l.index + 1}</div>
                  <div className="mt-1 truncate text-sm text-pencil">{l.words.slice(0, 3).map((w) => w.lemma).join(', ')}…</div>
                  <div className="mt-3 flex gap-1">
                    {STAGES.map((s) => (
                      <span key={s.id} className={`h-1.5 flex-1 rounded-full ${lp?.stages[s.id]?.done ? (s.id === 'boss' ? 'bg-pen' : 'bg-blue') : 'bg-line'}`} />
                    ))}
                  </div>
                  <div className="mt-2 text-sm text-pencil">
                    {strong}/{l.words.length} {t('state_strong').toLowerCase()}
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : (
        <WordBrowser words={words ?? []} />
      )}
    </div>
  );
}

function WordBrowser({ words }: { words: Word[] }) {
  const t = useT();
  const progress = useStore((s) => s.progress);
  const lang = useStore((s) => s.settings.meaningLang);
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(100);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const sorted = [...words].sort((a, b) => a.order - b.order);
    return s ? sorted.filter((w) => w.de.toLowerCase().includes(s) || w.en.toLowerCase().includes(s)) : sorted;
  }, [words, q]);

  return (
    <div>
      <div className="relative mb-4">
        <MagnifyingGlass size={18} weight="bold" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pencil" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} className="input !pl-10" type="search" />
      </div>
      <div className="card divide-y divide-line overflow-hidden">
        {filtered.slice(0, limit).map((w) => (
          <div key={w.id} className="flex items-center gap-3 px-4 py-3">
            <span className="hand w-10 shrink-0 text-lg text-pencil">L{Math.floor(w.order / 20) + 1}</span>
            <div className="min-w-0 flex-1">
              <GermanWord de={w.de} article={w.article} className="font-semibold" />
              <div className="truncate text-sm text-pencil">{fullMeaning(w, lang)}</div>
            </div>
            <StateBadge state={memoryState(progress[w.id])} />
          </div>
        ))}
        {filtered.length === 0 && <div className="p-6 text-center text-[15px] text-pencil">{t('noMatches')}</div>}
      </div>
      {filtered.length > limit && (
        <button className="btn-ghost mt-3 w-full" onClick={() => setLimit((l) => l + 200)}>
          {t('showMore', { n: Math.min(200, filtered.length - limit) })}
        </button>
      )}
    </div>
  );
}
