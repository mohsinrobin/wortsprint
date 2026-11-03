import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { navigate } from '../lib/router';
import { useT } from '../lib/i18n';
import type { ReactNode } from 'react';
import { CalendarCheck, CaretRight, Crosshair, Stack } from '@phosphor-icons/react';
import { Empty, gradeFor, ProgressBar, STATE_COLOR } from '../components/ui';
import { Hero } from '../looks/Hero';
import { BadgeIcon } from '../components/icons';
import { Ring } from '../components/marks';
import { buildLevels, stageCount, STAGES } from '../engine/levels';
import { currentStreak, levelFromXp, overview, selectReview, selectWeak } from '../engine/stats';
import { continueTarget, ladderPlay, stagePlay } from '../play/configs';
import type { MemoryState, Word } from '../types';

const STATES: MemoryState[] = ['new', 'learning', 'weak', 'familiar', 'strong', 'mastered'];

export function Dashboard() {
  const t = useT();
  const collections = useStore((s) => s.collections);
  const words = useStore((s) => s.words);
  const progress = useStore((s) => s.progress);
  const levels = useStore((s) => s.levels);
  const profile = useStore((s) => s.profile);
  const settings = useStore((s) => s.settings);
  const startPlay = useStore((s) => s.startPlay);
  const now = Date.now();

  const all = useMemo(() => Object.values(words).flat(), [words]);
  const ov = useMemo(() => overview(all, progress, now), [all, progress, now]);
  const byCollection = useMemo(() => collections.map((c) => ({ c, name: c.name, levels: buildLevels(c.id, words[c.id] ?? []) })), [collections, words]);
  const totalLevels = byCollection.reduce((n, x) => n + x.levels.length, 0);
  const target = continueTarget(byCollection, levels);
  const review = useMemo(() => selectReview(all, progress, now, settings.reviewSize), [all, progress, now, settings.reviewSize]);
  const dueOnly = review.filter((w) => progress[w.id]?.due && progress[w.id].due <= now).length;
  const weak = useMemo(() => selectWeak(all, progress, now, settings.reviewSize), [all, progress, now, settings.reviewSize]);
  const learnedWords = useMemo(() => {
    const scope = settings.practiceScope === 'selected' && settings.selectedLevels.length ? new Set(settings.selectedLevels) : null;
    const out: Word[] = [];
    for (const { levels: ls } of byCollection) {
      for (const l of ls) {
        if (scope ? scope.has(l.key) : !!levels[l.key]?.lastPlayed) out.push(...l.words);
      }
    }
    return out;
  }, [byCollection, levels, settings.practiceScope, settings.selectedLevels]);
  const streak = currentStreak(profile.practiceDays, now);
  const lvl = levelFromXp(profile.xp);

  const play = (c: Parameters<typeof startPlay>[0]) => {
    startPlay(c);
    navigate('/play');
  };

  const customWords = () => {
    const shuffled = [...learnedWords].sort((a, b) => (progress[a.id]?.strength ?? 0) - (progress[b.id]?.strength ?? 0));
    return shuffled.slice(0, settings.reviewSize);
  };

  const accGrade = ov.learned ? gradeFor(ov.accuracy) : null;

  return (
    <div className="space-y-8">
      {target ? (
        <Hero
          target={target}
          done={new Set(STAGES.filter((s) => levels[target.level.key]?.stages[s.id]?.done).map((s) => s.id))}
          progress={progress}
          lang={settings.meaningLang}
          streak={streak}
          due={ov.due}
          onPlay={() => play(stagePlay(target.level, target.stage, target.name, settings.uiLang))}
        />
      ) : (
        <Empty>
          <button className="btn-primary" onClick={() => navigate('/library')}>
            {t('navLibrary')}
          </button>
        </Empty>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Today */}
        <section>
          <h2 className="mb-3 text-xl font-bold">{t('today')}</h2>
          <ul className="card divide-y divide-line">
            <ModeRow
              icon={<CalendarCheck size={22} weight="bold" />}
              title={t('dailyReview')}
              desc={review.length ? t('dailyReviewDesc') : t('nothingDue')}
              count={ov.due}
              tone="text-blue"
              note={dueOnly < review.length && review.length > 0 ? `+${review.length - dueOnly} ${t('weakWords').toLowerCase()}` : undefined}
              disabled={review.length === 0}
              onClick={() => play(ladderPlay(t('dailyReview'), review))}
            />
            <ModeRow icon={<Crosshair size={22} weight="bold" />} title={t('weakTraining')} desc={weak.length ? t('weakTrainingDesc') : t('noWeak')} count={weak.length} tone="text-pen" disabled={weak.length === 0} onClick={() => play(ladderPlay(t('weakTraining'), weak))} />
            <ModeRow icon={<Stack size={22} weight="bold" />} title={t('customPractice')} desc={learnedWords.length ? t('customPracticeDesc') : t('noSessions')} count={learnedWords.length} tone="text-ink" disabled={learnedWords.length === 0} onClick={() => play(ladderPlay(t('customPractice'), customWords()))} />
          </ul>

          {/* Memory map */}
          <h2 className="mb-3 mt-8 text-xl font-bold">{t('memoryMap')}</h2>
          <div className="card p-5">
            <div className="flex h-4 overflow-hidden rounded-[3px] border border-line bg-paper">
              {STATES.map((s) => (ov.byState[s] ? <div key={s} className={STATE_COLOR[s]} style={{ width: `${(ov.byState[s] / Math.max(1, ov.total)) * 100}%` }} title={`${t(`state_${s}`)}: ${ov.byState[s]}`} /> : null))}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[15px] sm:grid-cols-3">
              {STATES.map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <dt className="flex items-center gap-2 text-pencil">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-[2px] border border-ink/10 ${STATE_COLOR[s]}`} />
                    {t(`state_${s}`)}
                  </dt>
                  <dd className="ml-auto font-semibold">{ov.byState[s]}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Report card */}
        <section>
          <h2 className="mb-3 text-xl font-bold">{t('reportCard')}</h2>
          <div className="card px-5 py-4">
            <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
              <div>
                <div className="text-[15px] text-pencil">{t('accuracy')}</div>
                <div className="text-2xl font-bold">{ov.learned ? `${Math.round(ov.accuracy * 100)}%` : '—'}</div>
              </div>
              {accGrade && (
                <div className="text-center">
                  <Ring>
                    <span className="hand text-4xl font-bold leading-none text-pen">{accGrade.grade}</span>
                  </Ring>
                  <div className="hand -mt-1 text-[15px] text-pen">{accGrade.word}</div>
                </div>
              )}
            </div>
            <dl className="divide-y divide-dashed divide-line text-[15px]">
              <Row label={t('totalVocab')} value={ov.total} />
              <Row label={t('totalLevels')} value={totalLevels} />
              <Row label={t('learned')} value={ov.learned} />
              <Row label={t('mastered')} value={ov.mastered} />
              <Row label={t('weakWords')} value={ov.weak} warn={ov.weak > 0} />
              <Row label={t('dueReview')} value={ov.due} />
              <Row label={t('streak')} value={streak} />
              <Row label={t('avgSpeed')} value={ov.avgMs ? `${(ov.avgMs / 1000).toFixed(1)}s` : '—'} />
              <Row label={`${t('playerLevel')} ${lvl.level}`} value={`${profile.xp} ${t('xp')}`} />
            </dl>
            <ProgressBar value={lvl.into / lvl.need} className="mb-1 mt-2" />
          </div>
        </section>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Collections */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xl font-bold">{t('collections')}</h2>
            <button className="flex items-center gap-1 text-sm font-semibold text-blue hover:underline" onClick={() => navigate('/library')}>
              {t('navLibrary')}
            </button>
          </div>
          <ul className="card divide-y divide-line">
            {byCollection.map(({ c, levels: ls }) => {
              const passed = ls.filter((l) => levels[l.key]?.bossPassed).length;
              const stages = ls.reduce((n, l) => n + stageCount(levels[l.key]), 0);
              return (
                <li key={c.id}>
                  <button className="w-full px-5 py-3.5 text-left hover:bg-blue-soft/40" onClick={() => navigate(`/c/${encodeURIComponent(c.id)}`)}>
                    <div className="flex justify-between gap-3 text-[15px]">
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-sm text-pencil">
                        {passed}/{ls.length} {t('levels')}
                      </span>
                    </div>
                    <ProgressBar value={stages / Math.max(1, ls.length * STAGES.length)} className="mt-2" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Recent */}
        <section>
          <h2 className="mb-3 text-xl font-bold">{t('recentSessions')}</h2>
          <div className="card px-5 py-3">
            {profile.recent.length === 0 ? (
              <div className="py-2 text-[15px] text-pencil">{t('noSessions')}</div>
            ) : (
              <ul className="divide-y divide-dashed divide-line">
                {profile.recent.slice(0, 6).map((r) => (
                  <li key={r.at} className="flex items-center justify-between gap-3 py-2 text-[15px]">
                    <span className="min-w-0 truncate">{r.title}</span>
                    <span className="flex shrink-0 items-baseline gap-3">
                      <span className="text-sm text-pencil">{Math.round(r.accuracy * 100)}%</span>
                      <span className={`hand w-5 text-center text-xl font-bold ${r.accuracy >= 0.81 ? 'text-ok' : 'text-pen'}`}>{gradeFor(r.accuracy).grade}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {profile.badges.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 border-t border-line pb-1 pt-3">
                {profile.badges.map((b, i) => (
                  <span key={b} className={`flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold-soft px-2.5 py-1 text-sm font-semibold text-gold ${i % 2 ? 'rotate-1' : '-rotate-1'}`} title={t(`badge_${b}` as never)}>
                    <BadgeIcon id={b} size={15} /> {t(`badge_${b}` as never)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value, warn }: { label: string; value: ReactNode; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-pencil">{label}</dt>
      <dd className={`font-semibold ${warn ? 'text-pen' : ''}`}>{value}</dd>
    </div>
  );
}

function ModeRow(p: { icon: ReactNode; title: string; desc: string; count: number; tone: string; disabled: boolean; onClick: () => void; note?: string }) {
  return (
    <li>
      <button disabled={p.disabled} onClick={p.onClick} className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-blue-soft/40 disabled:cursor-default disabled:hover:bg-transparent">
        <span className={`shrink-0 ${p.disabled ? 'text-pencil/60' : p.tone}`}>{p.icon}</span>
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold ${p.disabled ? 'text-pencil' : ''}`}>{p.title}</span>
          <span className="block text-sm text-pencil">{p.desc}</span>
          {p.note && <span className="block text-sm text-pencil">{p.note}</span>}
        </span>
        <span className={`hand text-[26px] font-bold leading-none ${p.disabled ? 'text-pencil/50' : p.tone}`}>{p.count}</span>
        {!p.disabled && <CaretRight size={18} weight="bold" className="shrink-0 text-pencil transition-transform group-hover:translate-x-0.5" />}
      </button>
    </li>
  );
}
