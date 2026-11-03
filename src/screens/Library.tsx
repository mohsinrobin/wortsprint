import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { navigate } from '../lib/router';
import { useT } from '../lib/i18n';
import { PageHeader, ProgressBar, GermanWord } from '../components/ui';
import { parseAny, type ParseResult } from '../data/parse';
import { buildLevels } from '../engine/levels';
import { memoryState } from '../engine/srs';
import { fetchBundleIndex, type BundleInfo } from '../store/db';

export function Library() {
  const t = useT();
  const collections = useStore((s) => s.collections);
  const words = useStore((s) => s.words);
  const progress = useStore((s) => s.progress);
  const addBundled = useStore((s) => s.addBundled);
  const [bundles, setBundles] = useState<BundleInfo[]>([]);
  useEffect(() => {
    fetchBundleIndex().then(setBundles).catch(() => setBundles([]));
  }, []);
  const missingBundles = bundles.filter((b) => !collections.some((c) => c.id === b.id));

  return (
    <div className="space-y-6">
      <PageHeader title={t('library')} />
      <section className="grid gap-3 sm:grid-cols-2">
        {collections.map((c) => {
          const list = words[c.id] ?? [];
          const mastered = list.filter((w) => memoryState(progress[w.id]) === 'mastered').length;
          const learned = list.filter((w) => progress[w.id]?.encounters).length;
          return (
            <button key={c.id} onClick={() => navigate(`/c/${encodeURIComponent(c.id)}`)} className="card p-4 text-left transition hover:border-slate-500">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{c.name}</div>
                  {c.description && <div className="muted text-xs">{c.description}</div>}
                </div>
                <span className="muted text-xs">→</span>
              </div>
              <div className="muted mt-3 flex gap-3 text-xs">
                <span>
                  <b className="text-[var(--ink)]">{list.length}</b> {t('words')}
                </span>
                <span>
                  <b className="text-[var(--ink)]">{buildLevels(c.id, list).length}</b> {t('levels')}
                </span>
                <span>
                  <b className="text-sky-300">{learned}</b> {t('learned').toLowerCase()}
                </span>
                <span>
                  <b className="text-violet-300">{mastered}</b> {t('mastered').toLowerCase()}
                </span>
              </div>
              <ProgressBar value={learned / Math.max(1, list.length)} className="mt-3" color="bg-sky-400" />
            </button>
          );
        })}
      </section>

      <ImportPanel />

      {missingBundles.length > 0 && (
        <section className="card p-5">
          <div className="font-semibold">{t('restoreBundled')}</div>
          <div className="muted mb-3 text-sm">{t('restoreHelp')}</div>
          <div className="flex flex-wrap gap-2">
            {missingBundles.map((b) => (
              <button key={b.id} className="btn-ghost" onClick={() => addBundled(b.id)}>
                + {b.name} ({b.count})
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ImportPanel() {
  const t = useT();
  const collections = useStore((s) => s.collections);
  const words = useStore((s) => s.words);
  const importEntries = useStore((s) => s.importEntries);
  const [text, setText] = useState('');
  const [filename, setFilename] = useState('');
  const [target, setTarget] = useState<string>('__new');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const result: ParseResult | null = useMemo(() => (text.trim() ? parseAny(text, filename) : null), [text, filename]);
  const duplicates = useMemo(() => {
    if (!result || target === '__new') return 0;
    const seen = new Set((words[target] ?? []).map((w) => `${w.de.toLowerCase()}|${w.en.toLowerCase()}`));
    return result.entries.filter((e) => seen.has(`${e.de.toLowerCase()}|${e.en.toLowerCase()}`)).length;
  }, [result, target, words]);

  const onFile = async (f: File) => {
    setFilename(f.name.toLowerCase());
    setText(await f.text());
    setMessage('');
  };

  const doImport = async () => {
    if (!result?.entries.length) return;
    const r = await importEntries(target === '__new' ? { name: name || filename.replace(/\.\w+$/, '') || 'My words' } : { collectionId: target }, result.entries);
    setMessage(t('importedN', { n: r.added }));
    setText('');
    setFilename('');
    setName('');
    navigate(`/c/${encodeURIComponent(r.collectionId)}`);
  };

  return (
    <section className="card p-5">
      <div className="font-semibold">{t('importWords')}</div>
      <p className="muted mt-1 text-sm">{t('importHelp')}</p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setFilename('');
          setMessage('');
        }}
        placeholder={`${t('pasteHere')}\n\nder Apfel | apple | আপেল\ndas Brot | bread | রুটি\ntrinken | to drink | পান করা`}
        rows={7}
        className="input mt-3 font-mono text-sm"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept=".txt,.csv,.json,.tsv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
          📄 {t('chooseFile')}
        </button>
        {filename && <span className="muted text-xs">{filename}</span>}
      </div>

      {result && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 font-semibold text-emerald-300">{t('validN', { n: result.entries.length })}</span>
            {result.issues.length > 0 && <span className="rounded-full bg-red-400/10 px-2.5 py-1 font-semibold text-red-300">{t('issuesN', { n: result.issues.length })}</span>}
            {duplicates > 0 && <span className="rounded-full bg-amber-300/10 px-2.5 py-1 font-semibold text-amber-200">{t('duplicatesSkipped', { n: duplicates })}</span>}
          </div>
          {result.issues.length > 0 && (
            <ul className="max-h-28 overflow-auto rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-xs">
              {result.issues.slice(0, 50).map((i) => (
                <li key={i.line} className="font-mono">
                  <span className="text-red-300">#{i.line}</span> {i.reason}: <span className="muted">{i.text.slice(0, 60)}</span>
                </li>
              ))}
            </ul>
          )}
          {result.entries.length > 0 && (
            <div className="max-h-56 overflow-auto rounded-xl border border-[var(--line)]">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-[var(--surface-2)] text-xs uppercase tracking-wider text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2">{t('german')}</th>
                    <th className="px-3 py-2">{t('english')}</th>
                    <th className="px-3 py-2">{t('bengali')}</th>
                    <th className="px-3 py-2">{t('partOfSpeech')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.entries.slice(0, 100).map((e, i) => (
                    <tr key={i} className="border-t border-[var(--line)]">
                      <td className="px-3 py-1.5 font-medium">
                        <GermanWord de={e.de} article={e.article} />
                      </td>
                      <td className="muted px-3 py-1.5">{e.en}</td>
                      <td className="muted px-3 py-1.5">{e.bn ?? '—'}</td>
                      <td className="muted px-3 py-1.5 text-xs">{t(`pos_${e.pos}`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label className="label">{t('importInto')}</label>
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="input">
                <option value="__new">+ {t('newCollection')}</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {target === '__new' ? (
              <div>
                <label className="label">{t('collectionName')}</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="My words" />
              </div>
            ) : (
              <div />
            )}
            <button className="btn-primary" disabled={!result.entries.length} onClick={doImport}>
              {t('importBtn')} ({result.entries.length - duplicates})
            </button>
          </div>
        </div>
      )}
      {message && <div className="mt-3 text-sm text-emerald-300">{message}</div>}
    </section>
  );
}
