import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { navigate } from '../lib/router';
import { useT } from '../lib/i18n';
import { PageHeader, StateBadge, GermanWord, Empty } from '../components/ui';
import { buildLevels, checkMastery, isLevelUnlocked, isStageUnlocked, STAGES } from '../engine/levels';
import { memoryState } from '../engine/srs';
import { fullMeaning } from '../engine/questions';
import { ladderPlay, nextStage, speedPlay, stagePlay } from '../play/configs';
import { Crown, Lightning, Lock } from '@phosphor-icons/react';
import { STAGE_ICON } from '../components/icons';
import { Tick } from '../components/marks';


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
        <Empty>
          <Lock size={20} weight="bold" className="mx-auto mb-2" />
          {t('locked')}
        </Empty>
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
    <div className="space-y-8">
      <PageHeader title={`${t('level')} ${index + 1}`} subtitle={collection.name} back={back} right={lp?.mastered ? <Crown size={28} weight="fill" className="text-gold" aria-label={t('levelMastered')} /> : null} />

      <ol className="card divide-y divide-line">
        {STAGES.map((s, i) => {
          const res = lp?.stages[s.id];
          const unlocked = isStageUnlocked(lp, s.id);
          const isNext = upNext === s.id;
          const Icon = STAGE_ICON[s.id];
          return (
            <li key={s.id} className={`flex items-center gap-4 px-4 py-4 sm:px-5 ${isNext ? 'bg-blue-soft/50' : ''} ${!unlocked ? 'opacity-50' : ''}`}>
              <span className="hand w-5 shrink-0 text-center text-2xl font-bold text-pencil">{i + 1}</span>
              <span className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full border-[1.5px] ${res?.done ? 'border-ok/50 text-ok' : isNext ? 'border-blue text-blue' : 'border-line text-pencil'}`}>
                {res?.done ? <Tick size={26} /> : <Icon size={20} weight="bold" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className={`font-semibold ${s.id === 'boss' ? 'text-pen' : ''}`}>{t(`stage_${s.id}`)}</div>
                <div className="text-sm text-pencil">{t(`stageDesc_${s.id}`)}</div>
                {res && res.attempts > 0 && s.id !== 'learn' && (
                  <div className="mt-0.5 text-sm">
                    <span className="text-pencil">{t('best')}: </span>
                    <span className={`font-semibold ${res.bestAccuracy >= 0.85 ? 'text-ok' : 'text-pen'}`}>{Math.round(res.bestAccuracy * 100)}%</span>
                  </div>
                )}
              </div>
              <button disabled={!unlocked} onClick={() => play(stagePlay(level, s.id, collection.name, settings.uiLang))} className={isNext ? 'btn-primary' : 'btn-ghost'}>
                {!unlocked ? <Lock size={16} weight="bold" aria-label={t('locked')} /> : res?.done ? t('replay') : t('play')}
              </button>
            </li>
          );
        })}
      </ol>

      <section className="grid gap-4 sm:grid-cols-2">
        <button
          disabled={!lp?.stages.learn?.done}
          onClick={() => play(speedPlay(level, progress, collection.name, settings.uiLang))}
          className="card flex items-center gap-4 p-5 text-left transition-shadow hover:shadow-lift disabled:opacity-50 disabled:hover:shadow-sheet"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-marker text-ink">
            <Lightning size={22} weight="fill" />
          </span>
          <div>
            <div className="font-semibold">{t('speedChallenge')}</div>
            <div className="text-sm text-pencil">{t('speedDesc')}</div>
          </div>
        </button>
        <div className="card p-5">
          <h2 className="mb-3 font-bold">{t('masteryTitle')}</h2>
          <ul className="space-y-2 text-[15px]">
            {mastery.requirements.map((r) => (
              <li key={r.id} className="flex items-center gap-2.5">
                <span className="relative grid h-5 w-5 shrink-0 place-items-center rounded-[3px] border-[1.5px] border-pencil/50">
                  {r.met && (
                    <span className="absolute -top-2 left-0.5">
                      <Tick size={22} />
                    </span>
                  )}
                </span>
                <span className={r.met ? '' : 'text-pencil'}>{t(`req_${r.id}`)}</span>
                {r.id === 'overall' && lp && <span className="ml-auto text-sm text-pencil">{Math.round(mastery.overall * 100)}%</span>}
                {r.id === 'typing' && lp && <span className="ml-auto text-sm text-pencil">{Math.round(mastery.typing * 100)}%</span>}
                {r.id === 'recall' && <span className="ml-auto text-sm text-pencil">{lp?.recallTested.filter((id) => level.words.some((w) => w.id === id)).length ?? 0}/{level.words.length}</span>}
              </li>
            ))}
          </ul>
          {weakWords.length > 0 && (
            <button className="btn-danger mt-4 w-full" onClick={() => play(ladderPlay(`${t('reviewWeak')}: ${t('level')} ${index + 1}`, weakWords, `/c/${encodeURIComponent(collectionId)}/l/${index}`, level.key))}>
              {t('reviewWeak')} ({weakWords.length})
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">{t('levelWords')}</h2>
        <div className="card divide-y divide-line">
          {level.words.map((w) => {
            const p = progress[w.id];
            const reveal = !!lp?.stages.learn?.done || !!p?.encounters;
            return (
              <div key={w.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <GermanWord de={w.de} article={w.article} className="font-semibold" />
                  <div className="truncate text-sm text-pencil">{reveal ? fullMeaning(w, settings.meaningLang) : '•••'}</div>
                </div>
                {p && p.encounters > 0 && (
                  <span className="hidden text-sm text-pencil sm:inline">
                    {p.correct}/{p.encounters}
                    {p.avgMs ? <span className="ml-2">{(p.avgMs / 1000).toFixed(1)}s</span> : null}
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
