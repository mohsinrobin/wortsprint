// Play screen: Learn previews (stage 1), the session runner, and the summary.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Word } from '../types';
import { useStore } from '../store/useStore';
import { navigate } from '../lib/router';
import { useT } from '../lib/i18n';
import { play as sfx } from '../lib/sfx';
import confetti from 'canvas-confetti';
import { ArrowLeft, ShareNetwork, SpeakerHigh, X } from '@phosphor-icons/react';
import { GermanWord, gradeFor, StateBadge } from '../components/ui';
import { BadgeIcon } from '../components/icons';
import { Ring, Stamp, Tick } from '../components/marks';
import { SessionRunner, type RunnerResult } from './SessionRunner';
import { summarize, type AnswerRecord, type SessionSummary } from '../engine/session';
import { buildLevels, checkMastery, evaluateBoss, PASS_ACCURACY, PASS_TYPING } from '../engine/levels';
import { memoryState } from '../engine/srs';
import { fullMeaning } from '../engine/questions';
import { challengePlay, ladderPlay, nextStage, stagePlay } from './configs';
import { CHALLENGES } from '../engine/challenge';
import { speak } from './speak';
import { useLook } from '../lib/look';

const GROUP = 5;

/** Theme colour as hex for canvas-confetti, read from the live CSS variables. */
function cssColor(name: string): string {
  const rgb = getComputedStyle(document.documentElement).getPropertyValue(`--c-${name}`).trim().split(/\s+/).map(Number);
  return '#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join('');
}

export function Play() {
  const config = useStore((s) => s.play);
  const [runId, setRunId] = useState(0);
  useEffect(() => {
    if (!config) navigate('/');
  }, [config]);
  if (!config) return null;
  return <PlayInner key={`${runId}-${config.title}-${config.wordIds.join()}`} onReplay={() => setRunId((n) => n + 1)} />;
}

function PlayInner({ onReplay }: { onReplay: () => void }) {
  const t = useT();
  const config = useStore((s) => s.play)!;
  const wordById = useStore((s) => s.wordById);
  const finishSession = useStore((s) => s.finishSession);
  const sound = useStore((s) => s.settings.sound);
  const isLearn = config.stage === 'learn';

  const groups = useMemo(() => {
    const out: string[][] = [];
    for (let i = 0; i < config.wordIds.length; i += GROUP) out.push(config.wordIds.slice(i, i + GROUP));
    return out;
  }, [config.wordIds]);

  const [group, setGroup] = useState(0);
  const [phase, setPhase] = useState<'preview' | 'run' | 'done'>(isLearn ? 'preview' : 'run');
  const [cardIdx, setCardIdx] = useState(0);
  const historyRef = useRef<AnswerRecord[]>([]);
  const totals = useRef({ xp: 0, score: 0, maxCombo: 0 });
  const [result, setResult] = useState<SummaryResult | null>(null);

  const quit = () => {
    if (historyRef.current.length === 0 || window.confirm(t('quitConfirm'))) navigate(config.returnTo);
  };

  const finish = () => {
    const history = historyRef.current;
    const summary = summarize(history);
    const recallWordIds = [...new Set(history.filter((h) => h.typed).map((h) => h.wordId))];
    const r = finishSession({ config, summary, xp: totals.current.xp, recallWordIds, speedScore: totals.current.score, maxCombo: totals.current.maxCombo });
    sfx('finish', sound);
    setResult({ summary, ...r, ...totals.current });
    setPhase('done');
  };

  const onRunDone = (r: RunnerResult) => {
    historyRef.current = [...historyRef.current, ...r.history];
    totals.current = { xp: totals.current.xp + r.xp, score: totals.current.score + r.score, maxCombo: Math.max(totals.current.maxCombo, r.maxCombo) };
    if (isLearn && group + 1 < groups.length) {
      setGroup((g) => g + 1);
      setCardIdx(0);
      setPhase('preview');
    } else finish();
  };

  if (phase === 'done' && result) return <Summary result={result} onReplay={onReplay} />;

  if (phase === 'preview') {
    const ids = groups[group];
    const w = wordById(ids[cardIdx]);
    return (
      <LearnCard
        word={w}
        index={group * GROUP + cardIdx}
        total={config.wordIds.length}
        last={cardIdx === ids.length - 1}
        onNext={() => {
          sfx('flip', sound);
          if (cardIdx + 1 < ids.length) setCardIdx((i) => i + 1);
          else setPhase('run');
        }}
        onBack={cardIdx > 0 ? () => setCardIdx((i) => i - 1) : undefined}
        onQuit={quit}
      />
    );
  }

  return (
    <SessionRunner
      key={`run-${group}`}
      mode={config.mode}
      wordIds={isLearn ? groups[group] : config.wordIds}
      extra={config.extra}
      onDone={onRunDone}
      onQuit={quit}
    />
  );
}

function LearnCard({ word, index, total, last, onNext, onBack, onQuit }: { word?: Word; index: number; total: number; last: boolean; onNext: () => void; onBack?: () => void; onQuit: () => void }) {
  const t = useT();
  const lang = useStore((s) => s.settings.meaningLang);
  const look = useLook();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        onNext();
      }
      if (e.key === 'ArrowLeft' && onBack) onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNext, onBack]);
  if (!word) {
    onNext();
    return null;
  }
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-xl flex-col">
      <div className="flex items-center gap-3">
        <button onClick={onQuit} className="btn-ghost h-10 w-10 !p-0" aria-label={t('quit')}>
          <X size={18} weight="bold" />
        </button>
        <div className="flex-1 text-center text-sm font-semibold text-pencil">
          {t('wordOf', { n: index + 1, total })}
        </div>
        <div className="w-10" />
      </div>
      <div key={word.id} className="flex flex-1 animate-pop flex-col items-center justify-center py-8">
        {look === 'bahn' ? (
          // Fahrplan: the word on a station sign, the meaning on the timetable below.
          <div className="w-full overflow-hidden rounded-sheet shadow-lift">
            <div className="bg-board px-6 pb-5 pt-4 text-center text-boardink">
              <div className="text-[15px] font-medium text-boardink/70">{t(`pos_${word.pos}`)}</div>
              <div className="mt-1 flex items-center justify-center gap-2">
                <span className="text-[40px] font-semibold leading-tight tracking-tight sm:text-5xl">
                  {word.article && word.de.startsWith(word.article + ' ') ? (
                    <>
                      <span className="text-signal">{word.article}</span> {word.de.slice(word.article.length + 1)}
                    </>
                  ) : (
                    word.de
                  )}
                </span>
                <button onClick={() => speak(word.de)} className="grid h-10 w-10 place-items-center rounded-full text-boardink/70 hover:bg-boardink/10 hover:text-boardink" aria-label={t('pronounce')}>
                  <SpeakerHigh size={22} weight="bold" />
                </button>
              </div>
            </div>
            <div className="bg-sheet px-6 py-5 text-center text-[21px] font-medium sm:text-2xl">{fullMeaning(word, lang)}</div>
          </div>
        ) : (
          /* Karteikarte: an index card with the red header rule */
          <div className="card w-full -rotate-[0.4deg] overflow-hidden">
            <div className="border-b-2 border-pen/70 px-6 pb-4 pt-6 text-center">
              <div className="hand text-xl text-pencil">{t(`pos_${word.pos}`)}</div>
              <div className="mt-1 flex items-center justify-center gap-2">
                <GermanWord de={word.de} article={word.article} className="text-[40px] font-bold leading-tight tracking-tight sm:text-5xl" />
                <button onClick={() => speak(word.de)} className="grid h-10 w-10 place-items-center rounded-full text-pencil hover:bg-ink/5 hover:text-ink" aria-label={t('pronounce')}>
                  <SpeakerHigh size={22} weight="bold" />
                </button>
              </div>
            </div>
            <div className="bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_31px,rgb(var(--c-line))_31px,rgb(var(--c-line))_32px)] px-6 pb-6 pt-[6px] text-center text-[21px] font-medium leading-[32px] sm:text-2xl sm:leading-[32px]">
              {fullMeaning(word, lang)}
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-3 pb-2">
        {onBack && (
          <button onClick={onBack} className="btn-ghost px-5" aria-label={t('back')}>
            <ArrowLeft size={18} weight="bold" />
          </button>
        )}
        <button onClick={onNext} className="btn-primary flex-1 py-3 text-base">
          {last ? t('startCheck') : t('nextCard')}
        </button>
      </div>
    </div>
  );
}

interface SummaryResult {
  summary: SessionSummary;
  badges: string[];
  bossPassed?: boolean;
  challengePassed?: boolean;
  xp: number;
  score: number;
  maxCombo: number;
}

function Summary({ result, onReplay }: { result: SummaryResult; onReplay: () => void }) {
  const t = useT();
  const config = useStore((s) => s.play)!;
  const wordById = useStore((s) => s.wordById);
  const progress = useStore((s) => s.progress);
  const levels = useStore((s) => s.levels);
  const words = useStore((s) => s.words);
  const collections = useStore((s) => s.collections);
  const settings = useStore((s) => s.settings);
  const startPlay = useStore((s) => s.startPlay);
  const { summary } = result;
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  const level = useMemo(() => {
    if (!config.levelKey) return null;
    const [cid, idx] = config.levelKey.split(':');
    return buildLevels(cid, words[cid] ?? [])[Number(idx)] ?? null;
  }, [config.levelKey, words]);
  const collectionName = level ? (collections.find((c) => c.id === level.collectionId)?.name ?? '') : '';
  const lp = config.levelKey ? levels[config.levelKey] : undefined;
  const mastery = level ? checkMastery(level, lp, progress) : null;
  const next = level ? nextStage(lp) : null;
  const boss = config.stage === 'boss' ? evaluateBoss(summary) : null;
  const ch = config.challenge;
  const isChallenge = ch !== undefined;
  const examPassed = boss ? boss.passed : isChallenge ? !!result.challengePassed : undefined;
  const [shared, setShared] = useState(false);
  const share = async () => {
    const text = `${t('shareText', { n: (ch ?? 0) + 1, c: summary.correct, total: config.wordIds.length })} ${location.origin}${location.pathname}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setShared(true);
      }
    } catch {
      // Share sheet dismissed.
    }
  };

  const practice = summary.needsPractice.map((id) => wordById(id)).filter((w): w is Word => !!w);

  const go = (c: Parameters<typeof startPlay>[0]) => {
    startPlay(c);
    onReplay();
  };

  const grade = gradeFor(summary.accuracy);
  const celebrate = examPassed || (summary.answered >= 5 && grade.grade === 1);
  useEffect(() => {
    if (!celebrate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setTimeout(() => {
      confetti({ particleCount: 90, spread: 75, startVelocity: 38, origin: { y: 0.35 }, shapes: ['square'], scalar: 0.9, colors: ['blue', 'pen', 'marker', 'ok', 'sheet'].map(cssColor), disableForReducedMotion: true });
    }, 450);
    return () => clearTimeout(id);
  }, [celebrate]);

  return (
    <div className="mx-auto max-w-2xl animate-pop pb-10">
      <div className="pb-6 pt-8 text-center">
        <div className="text-[15px] text-pencil">{config.title}</div>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight">{t('sessionComplete')}</h1>
        <div className="mt-5 flex items-center justify-center gap-6">
          <div className="text-center">
            <Ring>
              <span className="hand text-6xl font-bold leading-none text-pen">{grade.grade}</span>
            </Ring>
            <div className="hand text-xl text-pen">{grade.word}</div>
          </div>
          {examPassed !== undefined && <Stamp tone={examPassed ? 'ok' : 'pen'}>{examPassed ? 'Bestanden!' : 'Nochmal!'}</Stamp>}
        </div>
        {boss && <p className="mx-auto mt-5 max-w-md text-[15px] text-pencil">{boss.passed ? t('bossPassed') : t('bossFailed')}</p>}
        {isChallenge && (
          <p className="mx-auto mt-5 max-w-md text-[15px] text-pencil">
            {examPassed ? t('mutprobePassedText', { n: summary.correct, total: config.wordIds.length }) : t('mutprobeFailedText', { n: summary.answered, total: config.wordIds.length })}
          </p>
        )}
      </div>

      <dl className="card grid grid-cols-2 divide-x divide-y divide-line overflow-hidden sm:grid-cols-4 sm:divide-y-0">
        <SummaryStat label={t('sessionAccuracy')} value={pct(summary.accuracy)} good={summary.accuracy >= PASS_ACCURACY} />
        <SummaryStat label={t('typingAccuracy')} value={summary.typedAnswered ? pct(summary.typingAccuracy) : '—'} good={summary.typedAnswered ? summary.typingAccuracy >= PASS_TYPING : undefined} />
        <SummaryStat label={t('avgSpeed')} value={summary.avgMs ? `${(summary.avgMs / 1000).toFixed(1)}s` : '—'} />
        <SummaryStat label={t('xpEarned')} value={<span className="hand text-[26px] text-blue">+{result.xp}</span>} />
      </dl>
      {config.mode.type === 'speed' && (
        <dl className="card mt-3 grid grid-cols-2 divide-x divide-line overflow-hidden">
          <SummaryStat label={t('finalScore')} value={<span className="hand text-[26px] text-blue">{result.score}</span>} />
          <SummaryStat label={t('maxCombo')} value={`×${result.maxCombo}`} />
        </dl>
      )}

      {result.badges.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="hand text-xl font-bold text-gold">{t('newBadge')}</span>
          {result.badges.map((b, i) => (
            <span key={b} className={`flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold-soft px-3 py-1 text-sm font-semibold text-gold ${i % 2 ? 'rotate-2' : '-rotate-2'}`}>
              <BadgeIcon id={b} size={16} /> {t(`badge_${b}` as never)}
            </span>
          ))}
        </div>
      )}

      {mastery && (config.stage === 'boss' || lp?.bossPassed) && (
        <div className="card mt-5 p-5">
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
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <WordList title={t('needPractice')} ids={summary.needsPractice} tone="red" />
        <WordList title={t('solidWords')} ids={summary.solid} tone="green" />
      </div>

      <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {isChallenge && examPassed && CHALLENGES[ch + 1] && (
          <button className="btn flex-1 bg-pen text-sheet shadow-press hover:bg-pen/90" onClick={() => go(challengePlay(ch + 1))}>
            Mutprobe {ch + 2}
          </button>
        )}
        {isChallenge && examPassed && (
          <button className="btn-ghost flex-1" onClick={share}>
            <ShareNetwork size={18} weight="bold" aria-hidden /> {shared ? t('copied') : t('shareResult')}
          </button>
        )}
        {boss?.passed && level && (() => {
          const nextLevel = buildLevels(level.collectionId, words[level.collectionId] ?? [])[level.index + 1];
          return nextLevel ? (
            <button className="btn-primary flex-1" onClick={() => go(stagePlay(nextLevel, 'learn', collectionName, settings.uiLang))}>
              {t('level')} {nextLevel.index + 1}: {t('stage_learn')}
            </button>
          ) : null;
        })()}
        {next && level && config.stage !== 'boss' && (
          <button className="btn-primary flex-1" onClick={() => go(stagePlay(level, next, collectionName, settings.uiLang))}>
            {t('nextStage')}: {t(`stage_${next}`)}
          </button>
        )}
        {practice.length > 0 && (
          <button className="btn-ghost flex-1" onClick={() => go(ladderPlay(t('practiceMistakes'), practice, config.returnTo, config.levelKey))}>
            {t('practiceMistakes')} ({practice.length})
          </button>
        )}
        <button className="btn-ghost flex-1" onClick={onReplay}>
          {t('playAgain')}
        </button>
        <button className="btn-ghost flex-1" onClick={() => navigate(config.returnTo)}>
          {isChallenge ? t('backToMutprobe') : level ? t('backToLevel') : t('home')}
        </button>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, good }: { label: string; value: React.ReactNode; good?: boolean }) {
  return (
    <div className="px-4 py-3 text-center">
      <dt className="text-sm text-pencil">{label}</dt>
      <dd className={`mt-0.5 text-2xl font-bold ${good === undefined ? '' : good ? 'text-ok' : 'text-pen'}`}>{value}</dd>
    </div>
  );
}

function WordList({ title, ids, tone }: { title: string; ids: string[]; tone: 'red' | 'green' }) {
  const wordById = useStore((s) => s.wordById);
  const progress = useStore((s) => s.progress);
  const lang = useStore((s) => s.settings.meaningLang);
  if (!ids.length) return null;
  return (
    <div className={`min-w-0 rounded-sheet border p-4 shadow-sheet ${tone === 'red' ? 'border-pen/30 bg-pen-soft/60' : 'border-ok/30 bg-ok-soft/60'}`}>
      <h2 className={`mb-2 font-bold ${tone === 'red' ? 'text-pen' : 'text-ok'}`}>
        {title} <span className="hand ml-1 text-xl">{ids.length}</span>
      </h2>
      <ul className="max-h-72 divide-y divide-dashed divide-line overflow-auto pr-1">
        {ids.map((id) => {
          const w = wordById(id);
          if (!w) return null;
          return (
            <li key={id} className="flex items-center justify-between gap-2 py-1.5 text-[15px]">
              <span className="min-w-0 truncate">
                <GermanWord de={w.de} article={w.article} className="font-semibold" /> <span className="text-pencil">— {fullMeaning(w, lang)}</span>
              </span>
              <StateBadge state={memoryState(progress[id])} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
