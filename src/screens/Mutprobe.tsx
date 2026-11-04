// Mutprobe: the list of 50 hard-mode tests, and the start page for one.
import { CaretRight, Clock, Heart, Lock, ListNumbers, ProhibitInset, Sparkle } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useStore } from '../store/useStore';
import { navigate } from '../lib/router';
import { useT } from '../lib/i18n';
import { usePaid } from '../lib/premium';
import { useLook } from '../lib/look';
import { Empty, PageHeader, PremiumNotice, ProgressBar } from '../components/ui';
import { Tick } from '../components/marks';
import { CHALLENGES, READY_AT, challengeNeedsPremium, challengeTiers, isChallengeUnlocked, readiness } from '../engine/challenge';
import { challengePlay } from '../play/configs';

const TIER_NAME: Record<string, string> = { a1: 'A1', a2: 'A2', b1: 'B1', extra: 'Extra' };
export const tierLabel = (ids: string[]) => challengeTiers(ids).map((t) => TIER_NAME[t] ?? t).join(' · ');
const pct = (x: number) => Math.round(x * 100);

export function MutprobeList() {
  const t = useT();
  const results = useStore((s) => s.challenges);
  const paid = usePaid();
  const progress = useStore((s) => s.progress);
  const passed = CHALLENGES.filter((_, i) => results[i]?.passed).length;
  const current = CHALLENGES.findIndex((_, i) => !results[i]?.passed);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Mutprobe" subtitle={t('mutprobeTagline')} back={() => navigate('/library')} />

      <div className="card space-y-4 p-5">
        <p className="text-[15px] text-pencil">{t('mutprobeIntro')}</p>
        <Rules />
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="font-semibold">{t('mutprobeProgress', { n: passed })}</span>
          </div>
          <ProgressBar value={passed / CHALLENGES.length} color="bg-pen" />
        </div>
      </div>

      <ol className="card divide-y divide-line overflow-hidden">
        {CHALLENGES.map((ids, i) => {
          const r = results[i];
          const open = isChallengeUnlocked(i, results, paid);
          const premium = challengeNeedsPremium(i, paid);
          const ready = readiness(ids, progress);
          const isNext = i === current;
          return (
            <li key={i}>
              <button
                disabled={!open && !premium}
                onClick={() => navigate(`/mutprobe/${i}`)}
                className={`flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors sm:px-5 ${isNext ? 'bg-pen-soft/50' : ''} ${open ? 'hover:bg-ink/[0.03]' : premium ? 'opacity-60 hover:bg-ink/[0.03]' : 'opacity-50'}`}
              >
                <Number n={i + 1} state={r?.passed ? 'passed' : isNext ? 'next' : 'idle'} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{tierLabel(ids)}</span>
                  <span className="block text-sm text-pencil">
                    {open ? t('readyPct', { n: pct(ready) }) : premium ? t('premium') : t('locked')}
                    {r && r.attempts > 0 && <> · {t('bestRun', { n: r.best, total: ids.length })}</>}
                  </span>
                </span>
                {r?.passed ? <Tick size={28} /> : open ? <CaretRight size={18} weight="bold" className="text-pencil" /> : premium ? <Sparkle size={18} weight="fill" className="text-gold" aria-hidden /> : <Lock size={18} weight="bold" className="text-pencil" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function MutprobeDetail({ index }: { index: number }) {
  const t = useT();
  const results = useStore((s) => s.challenges);
  const paid = usePaid();
  const progress = useStore((s) => s.progress);
  const startPlay = useStore((s) => s.startPlay);
  const ids = CHALLENGES[index];
  const back = () => navigate('/mutprobe');

  if (ids && challengeNeedsPremium(index, paid)) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={`Mutprobe ${index + 1}`} subtitle={tierLabel(ids)} back={back} />
        <PremiumNotice body={t('premiumChallenges')} />
      </div>
    );
  }
  if (!ids || !isChallengeUnlocked(index, results, paid)) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={`Mutprobe ${index + 1}`} back={back} />
        <Empty>
          <Lock size={20} weight="bold" className="mx-auto mb-2" />
          {t('locked')}
        </Empty>
      </div>
    );
  }

  const r = results[index];
  const ready = readiness(ids, progress);
  const known = Math.round(ready * ids.length);
  const warn = ready < READY_AT;
  const start = () => {
    startPlay(challengePlay(index));
    navigate('/play');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={`Mutprobe ${index + 1}`} subtitle={tierLabel(ids)} back={back} />

      <div className="card overflow-hidden">
        <div className="border-b-2 border-pen/50 px-5 pb-4 pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-semibold">{t('readyPct', { n: pct(ready) })}</span>
            {r && r.attempts > 0 && (
              <span className="text-sm text-pencil">
                {t('bestRun', { n: r.best, total: ids.length })} · {t('attemptsN', { n: r.attempts })}
              </span>
            )}
          </div>
          <ReadyMeter value={ready} />
          <p className="mt-3 text-[15px]">{t('wordsKnown', { k: known, total: ids.length })}</p>
          <p className={`mt-0.5 text-[15px] font-semibold ${warn ? 'text-pen' : 'text-ok'}`}>{warn ? t('mutprobeWarn') : t('mutprobeReady')}</p>
        </div>
        <div className="space-y-5 p-5">
          <Rules />
          <button onClick={start} className="btn w-full bg-pen py-3.5 text-base text-sheet shadow-press hover:bg-pen/90">
            {warn ? t('tryAnyway') : t('startMutprobe')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Ready bar with a mark at 60 %. */
function ReadyMeter({ value }: { value: number }) {
  return (
    <div className="relative mt-2.5">
      <ProgressBar value={value} color={value >= READY_AT ? 'bg-ok' : 'bg-pen'} className="!h-2.5" />
      <span className="absolute -top-1 h-[18px] w-0.5 rounded-full bg-ink/60" style={{ left: `${READY_AT * 100}%` }} aria-hidden />
    </div>
  );
}

function Rules() {
  const t = useT();
  const rows: [ReactNode, string][] = [
    [<ProhibitInset key="a" size={18} weight="bold" />, t('rule_noLearn')],
    [<Clock key="b" size={18} weight="bold" />, t('rule_timer')],
    [<Heart key="c" size={18} weight="fill" />, t('rule_lives')],
    [<ListNumbers key="d" size={18} weight="bold" />, t('rule_order')],
  ];
  return (
    <ul className="grid gap-2 text-[15px] sm:grid-cols-2">
      {rows.map(([icon, text]) => (
        <li key={text} className="flex items-center gap-2.5">
          <span className="shrink-0 text-pen">{icon}</span>
          {text}
        </li>
      ))}
    </ul>
  );
}

function Number({ n, state }: { n: number; state: 'passed' | 'next' | 'idle' }) {
  const look = useLook();
  if (look === 'bahn')
    return (
      <span className={`grid h-10 w-11 shrink-0 place-items-center rounded-[4px] text-lg font-bold ${state === 'next' ? 'bg-pen text-sheet' : state === 'passed' ? 'bg-board text-boardink' : 'border border-line text-pencil'}`}>
        {n}
      </span>
    );
  return <span className={`hand w-9 shrink-0 text-center text-[28px] font-bold leading-none ${state === 'next' ? 'text-pen' : state === 'passed' ? 'text-blue' : 'text-pencil'}`}>{n}</span>;
}
