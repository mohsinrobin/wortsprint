import { useMemo, useState } from 'react';
import type { Pos, Word } from '../types';
import { useStore } from '../store/useStore';
import { navigate } from '../lib/router';
import { useT } from '../lib/i18n';
import { PageHeader, StateBadge, GermanWord, Empty } from '../components/ui';
import { buildLevels, isLevelUnlocked, STAGES, checkMastery } from '../engine/levels';
import { memoryState } from '../engine/srs';
import { parseGerman } from '../data/parse';
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
  const renameCollection = useStore((s) => s.renameCollection);
  const deleteCollection = useStore((s) => s.deleteCollection);
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
    startPlay(ladderPlay(`${collection.name} · ${t('practiceSelected')}`, pick, `/c/${encodeURIComponent(collectionId)}`));
    navigate('/play');
  };

  return (
    <div>
      <PageHeader
        title={collection.name}
        back={() => navigate('/library')}
        right={
          <div className="flex gap-2">
            <button
              className="btn-ghost !px-3"
              onClick={() => {
                const n = window.prompt(t('rename'), collection.name);
                if (n?.trim()) renameCollection(collectionId, n.trim());
              }}
            >
              ✎
            </button>
            <button
              className="btn-danger !px-3"
              title={t('deleteCollection')}
              onClick={async () => {
                if (window.confirm(t('confirmDeleteCollection'))) {
                  await deleteCollection(collectionId);
                  navigate('/library');
                }
              }}
            >
              🗑
            </button>
          </div>
        }
      />
      <div className="mb-5 flex items-center gap-2">
        {(['levels', 'words'] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? 'bg-white/10' : 'muted hover:text-[var(--ink)]'}`}>
            {k === 'levels' ? `${levels.length} ${t('levels')}` : `${words?.length ?? 0} ${t('words')}`}
          </button>
        ))}
        {tab === 'levels' && (
          <div className="ml-auto flex gap-2">
            {selecting && selected.size > 0 && (
              <button className="btn-primary !py-1.5" onClick={practiceSelected}>
                ▶ {t('practiceSelected')} ({[...selected].filter((k) => k.startsWith(`${collectionId}:`)).length})
              </button>
            )}
            <button className="btn-ghost !py-1.5" onClick={() => setSelecting((s) => !s)}>
              {selecting ? '✓' : '☐'} {t('practiceSelected')}
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
                  className={`card relative p-4 text-left transition ${unlocked || selecting ? 'hover:border-slate-500' : 'cursor-not-allowed opacity-50'} ${isSel && selecting ? '!border-emerald-400' : ''} ${mastered ? 'bg-violet-400/[0.06]' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">{t('level')}</div>
                    {selecting ? (
                      <span className={isSel ? 'text-emerald-400' : 'muted'}>{isSel ? '☑' : '☐'}</span>
                    ) : mastered ? (
                      <span title={t('levelMastered')}>👑</span>
                    ) : lp?.bossPassed ? (
                      <span title={t('levelPassed')}>✅</span>
                    ) : !unlocked ? (
                      <span title={t('locked')}>🔒</span>
                    ) : null}
                  </div>
                  <div className="text-3xl font-extrabold tabular-nums">{l.index + 1}</div>
                  <div className="muted mt-0.5 truncate text-xs">{l.words.slice(0, 3).map((w) => w.lemma).join(', ')}…</div>
                  <div className="mt-3 flex gap-1">
                    {STAGES.map((s) => (
                      <span key={s.id} className={`h-1.5 flex-1 rounded-full ${lp?.stages[s.id]?.done ? (s.id === 'boss' ? 'bg-violet-400' : 'bg-emerald-400') : 'bg-white/10'}`} />
                    ))}
                  </div>
                  <div className="muted mt-2 text-[11px] tabular-nums">
                    {strong}/{l.words.length} {t('state_strong').toLowerCase()}
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : (
        <WordsEditor collectionId={collectionId} words={words ?? []} />
      )}
    </div>
  );
}

const POS: Pos[] = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'other'];

function WordsEditor({ collectionId, words }: { collectionId: string; words: Word[] }) {
  const t = useT();
  const progress = useStore((s) => s.progress);
  const addWord = useStore((s) => s.addWord);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Word | 'new' | null>(null);
  const [limit, setLimit] = useState(100);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const sorted = [...words].sort((a, b) => a.order - b.order);
    return s ? sorted.filter((w) => w.de.toLowerCase().includes(s) || w.en.toLowerCase().includes(s) || w.bn?.includes(s)) : sorted;
  }, [words, q]);

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} className="input" />
        <button className="btn-primary shrink-0" onClick={() => setEditing('new')}>
          + {t('addWord')}
        </button>
      </div>
      {editing === 'new' && (
        <WordForm
          onCancel={() => setEditing(null)}
          onSave={(w) => {
            const g = parseGerman(w.de, w.pos);
            addWord(collectionId, { ...g, pos: g.article ? 'noun' : w.pos, en: w.en.trim(), bn: w.bn.trim() || undefined, situations: w.situations.length ? w.situations : undefined });
            setEditing(null);
          }}
        />
      )}
      <div className="card divide-y divide-[var(--line)] overflow-hidden">
        {filtered.slice(0, limit).map((w) =>
          editing !== 'new' && editing?.id === w.id ? (
            <div key={w.id} className="p-3">
              <WordForm word={w} onCancel={() => setEditing(null)} onSave={() => setEditing(null)} />
            </div>
          ) : (
            <div key={w.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="muted w-10 shrink-0 text-xs tabular-nums">L{Math.floor(w.order / 20) + 1}</span>
              <div className="min-w-0 flex-1">
                <GermanWord de={w.de} article={w.article} className="font-semibold" />
                <div className="muted truncate text-xs">
                  {w.en}
                  {w.bn ? ` · ${w.bn}` : ''}
                </div>
              </div>
              <StateBadge state={memoryState(progress[w.id])} />
              <button className="muted text-sm hover:text-[var(--ink)]" onClick={() => setEditing(w)}>
                ✎
              </button>
            </div>
          ),
        )}
        {filtered.length === 0 && <div className="muted p-6 text-center text-sm">—</div>}
      </div>
      {filtered.length > limit && (
        <button className="btn-ghost mt-3 w-full" onClick={() => setLimit((l) => l + 200)}>
          +{Math.min(200, filtered.length - limit)}
        </button>
      )}
    </div>
  );
}

interface FormValue {
  de: string;
  en: string;
  bn: string;
  pos: Pos;
  situations: string[];
}

function WordForm({ word, onSave, onCancel }: { word?: Word; onSave: (v: FormValue) => void; onCancel: () => void }) {
  const t = useT();
  const updateWord = useStore((s) => s.updateWord);
  const deleteWord = useStore((s) => s.deleteWord);
  const [v, setV] = useState<FormValue>({
    de: word?.de ?? '',
    en: word?.en ?? '',
    bn: word?.bn ?? '',
    pos: word?.pos ?? 'noun',
    situations: word?.situations ?? [],
  });

  const save = () => {
    if (!v.de.trim() || !v.en.trim()) return;
    if (word) {
      const g = parseGerman(v.de, v.pos);
      updateWord({ ...word, ...g, pos: g.article ? 'noun' : v.pos, en: v.en.trim(), bn: v.bn.trim() || undefined, situations: v.situations.filter(Boolean) });
    }
    onSave({ ...v, situations: v.situations.filter(Boolean) });
  };

  return (
    <div className="space-y-3 rounded-xl border border-emerald-400/30 bg-[var(--surface-2)] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">{t('german')}</label>
          <input value={v.de} onChange={(e) => setV({ ...v, de: e.target.value })} className="input" placeholder="der Apfel" lang="de" />
        </div>
        <div>
          <label className="label">{t('partOfSpeech')}</label>
          <select value={v.pos} onChange={(e) => setV({ ...v, pos: e.target.value as Pos })} className="input">
            {POS.map((p) => (
              <option key={p} value={p}>
                {t(`pos_${p}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t('english')}</label>
          <input value={v.en} onChange={(e) => setV({ ...v, en: e.target.value })} className="input" placeholder="apple" />
        </div>
        <div>
          <label className="label">{t('bengali')}</label>
          <input value={v.bn} onChange={(e) => setV({ ...v, bn: e.target.value })} className="input bn" placeholder="আপেল" />
        </div>
      </div>
      <div>
        <label className="label">{t('situationsLabel')}</label>
        <textarea value={v.situations.join('\n')} onChange={(e) => setV({ ...v, situations: e.target.value.split('\n') })} rows={3} className="input text-sm" />
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={save}>
          {t('save')}
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          {t('cancel')}
        </button>
        {word && (
          <button
            className="btn-danger ml-auto"
            onClick={() => {
              if (window.confirm(t('confirmDeleteWord'))) {
                deleteWord(word);
                onCancel();
              }
            }}
          >
            {t('delete')}
          </button>
        )}
      </div>
    </div>
  );
}
