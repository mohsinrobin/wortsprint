import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { navigate } from '../lib/router';
import { useT } from '../lib/i18n';
import { usePaid } from '../lib/premium';
import type { ReactNode } from 'react';
import { CalendarCheck, CaretDown, CaretRight, CheckCircle, Crosshair, Stack } from '@phosphor-icons/react';
import { Empty, gradeFor, ProgressBar, STATE_COLOR } from '../components/ui';
import { Hero } from '../looks/Hero';
import { BadgeIcon } from '../components/icons';
import { Ring } from '../components/marks';
import { buildLevels, STAGES } from '../engine/levels';
import { memoryState } from '../engine/srs';
import { currentStreak, levelFromXp, overview, selectReview, selectWeak } from '../engine/stats';
import { continueTarget, ladderPlay, stagePlay } from '../play/configs';
import type { MemoryState, Word } from '../types';

/** States of words already started; "new" is shown apart, as a small total. */
const STARTED: MemoryState[] = ['learning', 'weak', 'familiar', 'strong', 'mastered'];

/** "in 3 hours", "tomorrow", or "now" for a review time. */
function whenText(ts: number, now: number, lang: string, nowLabel: string): string {
  const diff = ts - now;
  if (diff <= 0) return nowLabel;
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const min = Math.round(diff / 60000);
  if (min < 60) return rtf.format(Math.max(1, min), 'minute');
  const h = Math.round(diff / 3600000);
  if (h < 24) return rtf.format(h, 'hour');
  return rtf.format(Math.round(diff / 86400000), 'day');
}

export function Dashboard() {
  const t = useT();
  const collections = useStore((s) => s.collections);
  const words = useStore((s) => s.words);
  const progress = useStore((s) => s.progress);
  const levels = useStore((s) => s.levels);
  const paid = usePaid();
  const profile = useStore((s) => s.profile);
  const settings = useStore((s) => s.settings);
  const startPlay = useStore((s) => s.startPlay);
  const now = Date.now();

  const all = useMemo(() => Object.values(words).flat(), [words]);
  const ov = useMemo(() => overview(all, progress, now), [all, progress, now]);
  const byCollection = useMemo(() => collections.map((c) => ({ c, name: c.name, levels: buildLevels(c.id, words[c.id] ?? []) })), [collections, words]);
  const totalLevels = byCollection.reduce((n, x) => n + x.levels.length, 0);
  const target = continueTarget(byCollection, levels, paid);
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
  const nextWhen = ov.nextDue ? whenText(ov.nextDue, now, settings.uiLang, t('reviewNow')) : '—';
  const levelWords = target?.level.words ?? [];
  const levelLearned = levelWords.filter((w) => memoryState(progress[w.id]) !== 'new').length;

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

      {/* Today: only what can be played right now. */}
      <section>
        <h2 className="mb-3 text-xl font-bold">{t('today')}</h2>
        {review.length || weak.length || learnedWords.length ? (
          <ul className="card divide-y divide-line">
            {review.length > 0 && (
              <ModeRow
                icon={<CalendarCheck size={22} weight="bold" />}
                title={t('dailyReview')}
                desc={t('dailyReviewDesc')}
                count={ov.due}
                tone="text-blue"
                note={dueOnly < review.length ? `+${review.length - dueOnly} ${t('weakWords').toLowerCase()}` : undefined}
                onClick={() => play(ladderPlay(t('dailyReview'), review))}
              />
            )}
            {weak.length > 0 && <ModeRow icon={<Crosshair size={22} weight="bold" />} title={t('weakTraining')} desc={t('weakTrainingDesc')} count={weak.length} tone="text-pen" onClick={() => play(ladderPlay(t('weakTraining'), weak))} />}
            {learnedWords.length > 0 && <ModeRow icon={<Stack size={22} weight="bold" />} title={t('customPractice')} desc={t('customPracticeDesc')} count={learnedWords.length} tone="text-ink" onClick={() => play(ladderPlay(t('customPractice'), customWords()))} />}
          </ul>
        ) : (
          <div className="card flex items-center gap-4 px-5 py-4">
            {ov.learned ? <CheckCircle size={26} weight="fill" className="shrink-0 text-ok" aria-hidden /> : <CalendarCheck size={24} weight="bold" className="shrink-0 text-pencil" aria-hidden />}
            <span className="min-w-0">
              <span className="block font-semibold">{t(ov.learned ? 'allCaughtUp' : 'nothingYet')}</span>
              <span className="block text-sm text-pencil">{!ov.learned ? t('nothingYetDesc') : ov.nextDue ? t('nextReviewIn', { when: nextWhen }) : t('allCaughtUpDesc')}</span>
            </span>
          </div>
        )}
      </section>

      {/* Statistics, folded away so the first screen stays about what to do next. */}
      <details className="card group overflow-hidden">
        <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block text-lg font-semibold">{t('yourProgress')}</span>
            <span className="block text-sm text-pencil">
              {t('progressSummary', { learned: ov.learned, mastered: ov.mastered })}
              {ov.learned > 0 && ` · ${Math.round(ov.accuracy * 100)}%`}
            </span>
          </span>
          <CaretDown size={18} weight="bold" className="shrink-0 text-pencil transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="grid gap-6 border-t border-line px-5 pb-5 pt-4 lg:grid-cols-2">
          <div className="space-y-6">
            {/* Memory map: what moved lately first, the size of the whole list last. */}
            <section>
              <h3 className="mb-2 font-semibold">{t('memoryMap')}</h3>
              <dl className="grid grid-cols-3 gap-2 text-center">
                <Stat label={t('thisWeek')} value={ov.week} />
                {target && <Stat label={`${t('level')} ${target.level.index + 1}`} value={`${levelLearned}/${levelWords.length}`} />}
                <Stat label={t('nextReview')} value={nextWhen} />
              </dl>
              {/* The bar is a picture of the numbers listed under it. */}
              <div className="mt-4 flex h-3 overflow-hidden rounded-[3px] border border-line bg-paper" aria-hidden>
                {STARTED.map((s) => (ov.byState[s] ? <div key={s} className={STATE_COLOR[s]} style={{ width: `${(ov.byState[s] / Math.max(1, ov.learned)) * 100}%` }} /> : null))}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[15px] sm:grid-cols-3">
                {STARTED.map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <dt className="flex items-center gap-2 text-pencil">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-[2px] border border-ink/10 ${STATE_COLOR[s]}`} />
                      {t(`state_${s}`)}
                    </dt>
                    <dd className="ml-auto font-semibold">{ov.byState[s]}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-sm text-pencil">{t('stillNew', { n: ov.byState.new.toLocaleString(settings.uiLang) })}</p>
            </section>

            {/* Recent sessions */}
            <section>
              <h3 className="mb-1 font-semibold">{t('recentSessions')}</h3>
              {profile.recent.length === 0 ? (
                <div className="py-1 text-[15px] text-pencil">{t('noSessions')}</div>
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
                    <span key={b} className={`flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold-soft px-2.5 py-1 text-sm font-semibold text-gold ${i % 2 ? 'rotate-1' : '-rotate-1'}`}>
                      <BadgeIcon id={b} size={15} /> {t(`badge_${b}` as never)}
                    </span>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Report card */}
          <section>
            <h3 className="mb-1 font-semibold">{t('reportCard')}</h3>
            <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
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
          </section>
        </div>
      </details>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col-reverse rounded-sheet border border-line bg-paper/60 px-2 py-2.5">
      <dt className="text-xs leading-tight text-pencil">{label}</dt>
      <dd className="text-lg font-bold leading-tight">{value}</dd>
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

function ModeRow(p: { icon: ReactNode; title: string; desc: string; count: number; tone: string; onClick: () => void; note?: string }) {
  return (
    <li>
      <button onClick={p.onClick} className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-blue-soft/40">
        <span className={`shrink-0 ${p.tone}`}>{p.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{p.title}</span>
          <span className="block text-sm text-pencil">{p.desc}</span>
          {p.note && <span className="block text-sm text-pencil">{p.note}</span>}
        </span>
        <span className={`hand text-[26px] font-bold leading-none ${p.tone}`}>{p.count}</span>
        <CaretRight size={18} weight="bold" className="shrink-0 text-pencil transition-transform group-hover:translate-x-0.5" />
      </button>
    </li>
  );
}
