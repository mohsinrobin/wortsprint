import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { navigate } from '../lib/router';
import { useT } from '../lib/i18n';
import { ProgressBar, Stat, STATE_COLOR, Empty } from '../components/ui';
import { buildLevels, stageCount, STAGES } from '../engine/levels';
import { BADGES, currentStreak, levelFromXp, overview, selectReview, selectWeak } from '../engine/stats';
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

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="card relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="text-xs font-medium uppercase tracking-wider text-emerald-400">{t('appTagline')}</div>
        {target ? (
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="muted text-sm">{target.name}</div>
              <div className="text-2xl font-bold sm:text-3xl">
                {t('level')} {target.level.index + 1} · {t(`stage_${target.stage}`)}
              </div>
              <div className="mt-3 flex gap-1.5">
                {STAGES.map((s) => (
                  <span key={s.id} className={`h-1.5 w-8 rounded-full ${levels[target.level.key]?.stages[s.id]?.done ? 'bg-emerald-400' : s.id === target.stage ? 'bg-emerald-400/40' : 'bg-white/10'}`} />
                ))}
              </div>
            </div>
            <button className="btn-primary px-6 py-3 text-base" onClick={() => play(stagePlay(target.level, target.stage, target.name, settings.uiLang))}>
              {t('continueLearning')} →
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <Empty>
              <button className="btn-primary" onClick={() => navigate('/library')}>
                {t('importWords')}
              </button>
            </Empty>
          </div>
        )}
        <div className="mt-5 flex items-center gap-3 text-xs">
          <span className="font-semibold text-violet-300">
            {t('playerLevel')} {lvl.level}
          </span>
          <ProgressBar value={lvl.into / lvl.need} color="bg-violet-400" className="max-w-xs" />
          <span className="muted tabular-nums">
            {profile.xp} {t('xp')}
          </span>
        </div>
      </section>

      {/* Practice modes */}
      <section className="grid gap-3 sm:grid-cols-3">
        <ModeCard
          title={t('dailyReview')}
          desc={t('dailyReviewDesc')}
          count={ov.due}
          countLabel={t('wordsDue')}
          accent="emerald"
          disabled={review.length === 0}
          emptyText={t('nothingDue')}
          onClick={() => play(ladderPlay(t('dailyReview'), review))}
          note={dueOnly < review.length && review.length > 0 ? `+${review.length - dueOnly} ${t('weakWords').toLowerCase()}` : undefined}
        />
        <ModeCard title={t('weakTraining')} desc={t('weakTrainingDesc')} count={weak.length} accent="red" disabled={weak.length === 0} emptyText={t('noWeak')} onClick={() => play(ladderPlay(t('weakTraining'), weak))} />
        <ModeCard title={t('customPractice')} desc={t('customPracticeDesc')} count={learnedWords.length} countLabel={t('words')} accent="sky" disabled={learnedWords.length === 0} emptyText={t('noSessions')} onClick={() => play(ladderPlay(t('customPractice'), customWords()))} />
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <Stat label={t('totalVocab')} value={ov.total} />
        <Stat label={t('totalLevels')} value={totalLevels} />
        <Stat label={t('learned')} value={ov.learned} accent="text-sky-300" />
        <Stat label={t('mastered')} value={ov.mastered} accent="text-violet-300" />
        <Stat label={t('weakWords')} value={ov.weak} accent="text-red-300" />
        <Stat label={t('dueReview')} value={ov.due} accent="text-emerald-300" />
        <Stat label={t('streak')} value={`🔥 ${streak}`} accent="text-amber-300" />
        <Stat label={t('accuracy')} value={ov.learned ? `${Math.round(ov.accuracy * 100)}%` : '—'} />
        <Stat label={t('avgSpeed')} value={ov.avgMs ? `${(ov.avgMs / 1000).toFixed(1)}s` : '—'} />
        <Stat label={t('badges')} value={`${profile.badges.length}/${BADGES.length}`} />
      </section>

      {/* Memory map */}
      <section className="card p-5">
        <div className="mb-3 text-sm font-semibold">{t('memoryMap')}</div>
        <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
          {STATES.map((s) => (ov.byState[s] ? <div key={s} className={STATE_COLOR[s]} style={{ width: `${(ov.byState[s] / Math.max(1, ov.total)) * 100}%` }} title={`${t(`state_${s}`)}: ${ov.byState[s]}`} /> : null))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {STATES.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${STATE_COLOR[s]}`} />
              <span className="muted">{t(`state_${s}`)}</span>
              <span className="font-semibold tabular-nums">{ov.byState[s]}</span>
            </span>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Collections */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">{t('collections')}</div>
            <button className="text-xs text-emerald-400 hover:underline" onClick={() => navigate('/library')}>
              {t('navLibrary')} →
            </button>
          </div>
          <ul className="space-y-3">
            {byCollection.map(({ c, levels: ls }) => {
              const passed = ls.filter((l) => levels[l.key]?.bossPassed).length;
              const stages = ls.reduce((n, l) => n + stageCount(levels[l.key]), 0);
              return (
                <li key={c.id}>
                  <button className="w-full text-left" onClick={() => navigate(`/c/${encodeURIComponent(c.id)}`)}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="muted text-xs tabular-nums">
                        {passed}/{ls.length} {t('levels')}
                      </span>
                    </div>
                    <ProgressBar value={stages / Math.max(1, ls.length * STAGES.length)} className="mt-1.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Recent */}
        <section className="card p-5">
          <div className="mb-3 text-sm font-semibold">{t('recentSessions')}</div>
          {profile.recent.length === 0 ? (
            <div className="muted text-sm">{t('noSessions')}</div>
          ) : (
            <ul className="space-y-2">
              {profile.recent.slice(0, 6).map((r) => (
                <li key={r.at} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{r.title}</span>
                  <span className="flex shrink-0 items-center gap-3 tabular-nums">
                    <span className={r.accuracy >= 0.85 ? 'text-emerald-300' : r.accuracy >= 0.6 ? 'text-amber-200' : 'text-red-300'}>{Math.round(r.accuracy * 100)}%</span>
                    <span className="text-xs text-violet-300">+{r.xp}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {profile.badges.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
              {profile.badges.map((b) => (
                <span key={b} className="rounded-full bg-white/5 px-2.5 py-1 text-xs" title={t(`badge_${b}` as never)}>
                  {BADGES.find((x) => x.id === b)?.icon} {t(`badge_${b}` as never)}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const ACCENTS = {
  emerald: 'text-emerald-300 bg-emerald-400/10',
  red: 'text-red-300 bg-red-400/10',
  sky: 'text-sky-300 bg-sky-400/10',
};

function ModeCard(p: { title: string; desc: string; count: number; countLabel?: string; accent: keyof typeof ACCENTS; disabled: boolean; emptyText: string; onClick: () => void; note?: string }) {
  return (
    <button disabled={p.disabled} onClick={p.onClick} className="card group flex flex-col p-4 text-left transition hover:border-slate-500 disabled:cursor-default disabled:hover:border-[var(--line)]">
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold">{p.title}</div>
        <span className={`rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums ${ACCENTS[p.accent]}`}>
          {p.count}
          {p.countLabel && <span className="ml-1 text-[10px] font-medium opacity-80">{p.countLabel}</span>}
        </span>
      </div>
      <div className="muted mt-1 text-xs">{p.disabled ? p.emptyText : p.desc}</div>
      {p.note && <div className="mt-1 text-[11px] text-[var(--muted)]">{p.note}</div>}
      {!p.disabled && <div className="mt-3 text-sm font-semibold text-emerald-400 group-hover:underline">▶</div>}
    </button>
  );
}
