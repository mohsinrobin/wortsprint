// The Home hero for each theme: one bold, world-specific element.
import type { Level } from '../engine/levels';
import { STAGES } from '../engine/levels';
import type { StageId, Word, WordProgress } from '../types';
import type { Settings } from '../types';
import { memoryState } from '../engine/srs';
import { meaningText } from '../engine/questions';
import { GermanWord } from '../components/ui';
import { Tick } from '../components/marks';
import { useT } from '../lib/i18n';
import { useLook } from '../lib/look';

export interface HeroProps {
  target: { level: Level; stage: StageId; name: string };
  done: Set<StageId>;
  progress: Record<string, WordProgress>;
  lang: Settings['meaningLang'];
  streak: number;
  due: number;
  onPlay: () => void;
}

const firstForm = (w: Word) => w.de.split(/,\s*/)[0];
const firstMeaning = (w: Word, lang: Settings['meaningLang']) => meaningText(w, lang, 1).replace(/ …$/, '');

export function Hero(p: HeroProps) {
  const look = useLook();
  if (look === 'bahn') return <BahnHero {...p} />;
  return <HeftHero {...p} />;
}

/* A — Schulheft: a page of the Vokabelheft, German left, meaning right. */
function HeftHero({ target, done, progress, lang, onPlay }: HeroProps) {
  const t = useT();
  const words = target.level.words.slice(0, 6);
  const stageNo = STAGES.findIndex((s) => s.id === target.stage) + 1;
  return (
    <section className="card overflow-hidden">
      <div className="flex items-end justify-between gap-4 border-b-2 border-pen/50 px-5 pb-3 pt-5 sm:px-7 sm:pt-6">
        <div className="min-w-0">
          <h1 className="text-[34px] font-semibold leading-none tracking-tight sm:text-[42px]">
            {t('level')} {target.level.index + 1}
          </h1>
          <p className="mt-1.5 truncate text-[15px] text-pencil">{target.name}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 pb-0.5">
          <ol className="flex gap-1.5" aria-hidden>
            {STAGES.map((s) => (
              <li key={s.id} title={t(`stage_${s.id}`)} className={`relative h-4 w-4 rounded-[3px] border-[1.5px] ${s.id === target.stage ? 'border-blue bg-blue-soft' : 'border-pencil/40'}`}>
                {done.has(s.id) && (
                  <span className="absolute -left-0.5 -top-2">
                    <Tick size={20} tone="blue" />
                  </span>
                )}
              </li>
            ))}
          </ol>
          <span className="text-sm text-pencil">
            <span className="font-semibold text-ink">{t('stageOf', { n: stageNo, total: STAGES.length })}</span> · {t(`stage_${target.stage}`)}
            <span className="sr-only">. {t('stagesDone', { n: done.size })}</span>
          </span>
        </div>
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-pen/30" aria-hidden />
        <ul>
          {words.map((w) => {
            const st = memoryState(progress[w.id]);
            return (
              <li key={w.id} className="grid h-11 grid-cols-2 items-center border-b border-line/70 text-[16px]">
                <GermanWord de={firstForm(w)} article={w.article} className="truncate px-5 font-medium sm:px-7" />
                <span className="flex min-w-0 items-center gap-2 px-5 text-pencil sm:px-7">
                  <span className="truncate">{firstMeaning(w, lang)}</span>
                  {(st === 'strong' || st === 'mastered') && <Tick size={20} />}
                  {st === 'weak' && <span className="hand text-xl font-bold leading-none text-pen">!</span>}
                </span>
              </li>
            );
          })}
        </ul>
        {target.level.words.length > words.length && <div className="hand px-5 pb-1 pt-2 text-xl text-pencil sm:px-7">{t('moreWords', { n: target.level.words.length - words.length })}</div>}
      </div>
      <div className="px-5 pb-5 pt-4 sm:px-7 sm:pb-6">
        <button className="btn-primary w-full px-6 py-3.5 text-base sm:w-auto" onClick={onPlay}>
          {t('continueWith', { stage: t(`stage_${target.stage}`) })}
        </button>
      </div>
    </section>
  );
}

/* B — Fahrplan: the departure board. The level is the destination, the
   stage is the platform, the six stages are the stops on the line. */
function BahnHero({ target, done, onPlay }: HeroProps) {
  const t = useT();
  const stageNo = STAGES.findIndex((s) => s.id === target.stage) + 1;
  const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const via = target.level.words.slice(0, 4).map((w) => w.lemma).join(', ');
  return (
    <section className="overflow-hidden rounded-sheet bg-board text-boardink shadow-lift">
      <div className="flex items-center justify-between border-b border-boardink/15 px-5 py-2.5 text-[15px] font-semibold">
        <span className="text-signal">Abfahrt</span>
        <span className="tabular-nums text-boardink/80">{time}</span>
      </div>
      <div className="flex items-stretch gap-4 px-5 pb-4 pt-5">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] text-boardink/75">{target.name}</div>
          <h1 className="mt-0.5 text-[44px] font-semibold leading-[0.95] tracking-tight">
            {t('level')} {target.level.index + 1}
          </h1>
          <div className="mt-2 truncate text-[15px] text-boardink/75">über {via}</div>
        </div>
        <div className="flex w-[72px] shrink-0 flex-col items-center justify-center rounded-[4px] bg-signal text-board">
          <span className="text-[13px] font-semibold">Gleis</span>
          <span className="text-[40px] font-bold leading-none">{stageNo}</span>
        </div>
      </div>
      {/* the line: six stops */}
      <div className="px-5 pb-5">
        <div className="relative flex items-center justify-between" aria-hidden>
          <span className="absolute inset-x-2 top-1/2 h-[3px] -translate-y-1/2 bg-boardink/25" aria-hidden />
          {STAGES.map((s) => {
            const isDone = done.has(s.id);
            const now = s.id === target.stage;
            return (
              <span
                key={s.id}
                title={t(`stage_${s.id}`)}
                className={`relative grid h-5 w-5 place-items-center rounded-full border-[3px] ${now ? 'border-signal bg-board' : isDone ? 'border-boardink bg-boardink' : 'border-boardink/40 bg-board'}`}
              />
            );
          })}
        </div>
        <div className="mt-2 text-[15px]">
          <span className="text-boardink/70">{t('stageOf', { n: stageNo, total: STAGES.length })}: </span>
          <span className="font-semibold">{t(`stage_${target.stage}`)}</span>
          <span className="sr-only">. {t('stagesDone', { n: done.size })}</span>
        </div>
        <button onClick={onPlay} className="mt-4 w-full rounded-[4px] bg-signal px-5 py-3.5 text-[17px] font-semibold text-board transition-transform active:scale-[0.99]">
          {t('continueWith', { stage: t(`stage_${target.stage}`) })}
        </button>
      </div>
    </section>
  );
}
