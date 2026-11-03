import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { navigate } from '../lib/router';
import { useT } from '../lib/i18n';
import { PageHeader, StateBadge, GermanWord, Empty } from '../components/ui';
import { buildLevels, checkMastery, isLevelUnlocked, isStageUnlocked, STAGES } from '../engine/levels';
import { memoryState } from '../engine/srs';
import { fullMeaning } from '../engine/questions';
import { ladderPlay, nextStage, speedPlay, stagePlay } from '../play/configs';

const STAGE_ICON = { learn: '👀', recognize: '🔍', reverse: '🔁', recall: '⌨️', situations: '🎭', boss: '👾' } as const;

export function LevelView({ collectionId, index }: { collectionId: string; index: number }) {
  const t = useT();
  const collection = useStore((s) => s.collections.find((c) => c.id === collectionId));
  const words = useStore((s) => s.words[collectionId]);
  const progress = useStore((s) => s.progress);
  const levelProgress = useStore((s) => s.levels);
  const settings = useStore((s) => s.settings);
  const startPlay = useStore((s) => s.startPlay);

  const levels = useMemo(() => buildLevels(collectionId, words ?? []), [collectionId, words]);
  const level = levels[index];
  const back = () => navigate(`/c/${encodeURIComponent(collectionId)}`);
  if (!collection || !level) {
    return (
      <div>
        <PageHeader title="—" back={back} />
        <Empty>Level not found.</Empty>
      </div>
    );
  }
  if (!isLevelUnlocked(levels, index, levelProgress)) {
    return (
      <div>
        <PageHeader title={`${t('level')} ${index + 1}`} back={back} />
        <Empty>🔒 {t('locked')}</Empty>
      </div>
    );
  }

  const lp = levelProgress[level.key];
  const mastery = checkMastery(level, lp, progress);
  const upNext = nextStage(lp);
  const play = (c: Parameters<typeof startPlay>[0]) => {
    startPlay(c);
    navigate('/play');
  };
  const weakWords = level.words.filter((w) => mastery.weakWords.includes(w.id));

  return (
    <div className="space-y-6">
      <PageHeader title={`${collection.name} · ${t('level')} ${index + 1}`} back={back} right={lp?.mastered ? <span className="text-2xl">👑</span> : null} />

      <section className="space-y-2">
        {STAGES.map((s, i) => {
          const res = lp?.stages[s.id];
          const unlocked = isStageUnlocked(lp, s.id);
          const isNext = upNext === s.id;
          return (
            <div key={s.id} className={`card flex items-center gap-4 p-4 ${isNext ? '!border-emerald-400/60' : ''} ${!unlocked ? 'opacity-50' : ''}`}>
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl ${res?.done ? 'bg-emerald-400/15' : 'bg-white/5'}`}>{res?.done ? '✓' : STAGE_ICON[s.id]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="muted text-xs tabular-nums">{i + 1}</span>
                  <span className="font-semibold">{t(`stage_${s.id}`)}</span>
                </div>
                <div className="muted text-xs">{t(`stageDesc_${s.id}`)}</div>
                {res && res.attempts > 0 && s.id !== 'learn' && (
                  <div className="mt-1 text-xs">
                    <span className="muted">{t('best')}: </span>
                    <span className={res.bestAccuracy >= 0.85 ? 'text-emerald-300' : 'text-amber-200'}>{Math.round(res.bestAccuracy * 100)}%</span>
                  </div>
                )}
              </div>
              <button disabled={!unlocked} onClick={() => play(stagePlay(level, s.id, collection.name, settings.uiLang))} className={isNext ? 'btn-primary' : 'btn-ghost'}>
                {res?.done ? t('replay') : t('play')}
              </button>
            </div>
          );
        })}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <button
          disabled={!lp?.stages.learn?.done}
          onClick={() => play(speedPlay(level, progress, collection.name, settings.uiLang))}
          className="card flex items-center gap-4 p-4 text-left transition hover:border-amber-300/50 disabled:opacity-50 disabled:hover:border-[var(--line)]"
        >
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-300/10 text-xl">⚡</div>
          <div>
            <div className="font-semibold">{t('speedChallenge')}</div>
            <div className="muted text-xs">{t('speedDesc')}</div>
          </div>
        </button>
        <div className="card p-4">
          <div className="mb-2 text-sm font-semibold">{t('masteryTitle')}</div>
          <ul className="space-y-1 text-sm">
            {mastery.requirements.map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                <span className={r.met ? 'text-emerald-400' : 'text-[var(--muted)]'}>{r.met ? '✓' : '○'}</span>
                <span className={r.met ? '' : 'muted'}>{t(`req_${r.id}`)}</span>
                {r.id === 'overall' && lp && <span className="muted ml-auto text-xs tabular-nums">{Math.round(mastery.overall * 100)}%</span>}
                {r.id === 'typing' && lp && <span className="muted ml-auto text-xs tabular-nums">{Math.round(mastery.typing * 100)}%</span>}
                {r.id === 'recall' && <span className="muted ml-auto text-xs tabular-nums">{lp?.recallTested.filter((id) => level.words.some((w) => w.id === id)).length ?? 0}/{level.words.length}</span>}
              </li>
            ))}
          </ul>
          {weakWords.length > 0 && (
            <button className="btn-danger mt-3 w-full" onClick={() => play(ladderPlay(`${t('level')} ${index + 1} · ${t('reviewWeak')}`, weakWords, `/c/${encodeURIComponent(collectionId)}/l/${index}`, level.key))}>
              {t('reviewWeak')} ({weakWords.length})
            </button>
          )}
        </div>
      </section>

      <section>
        <div className="mb-2 text-sm font-semibold">{t('levelWords')}</div>
        <div className="card divide-y divide-[var(--line)]">
          {level.words.map((w) => {
            const p = progress[w.id];
            const reveal = !!lp?.stages.learn?.done || !!p?.encounters;
            return (
              <div key={w.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <GermanWord de={w.de} article={w.article} className="font-semibold" />
                  <div className="muted truncate text-xs">{reveal ? fullMeaning(w, settings.meaningLang) : '•••'}</div>
                </div>
                {p && p.encounters > 0 && (
                  <span className="muted hidden text-xs tabular-nums sm:inline">
                    {p.correct}/{p.encounters}
                    {p.avgMs ? ` · ${(p.avgMs / 1000).toFixed(1)}s` : ''}
                  </span>
                )}
                <StateBadge state={memoryState(p)} />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
