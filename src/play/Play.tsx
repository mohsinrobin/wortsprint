// Play screen: Learn previews (stage 1), the session runner, and the summary.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Word } from '../types';
import { useStore } from '../store/useStore';
import { navigate } from '../lib/router';
import { useT } from '../lib/i18n';
import { play as sfx } from '../lib/sfx';
import { GermanWord, StateBadge } from '../components/ui';
import { SessionRunner, type RunnerResult } from './SessionRunner';
import { summarize, type AnswerRecord, type SessionSummary } from '../engine/session';
import { buildLevels, checkMastery, evaluateBoss, PASS_ACCURACY, PASS_TYPING } from '../engine/levels';
import { memoryState } from '../engine/srs';
import { fullMeaning } from '../engine/questions';
import { BADGES } from '../engine/stats';
import { ladderPlay, nextStage, stagePlay } from './configs';
import { speak } from './speak';

const GROUP = 5;

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
  const [result, setResult] = useState<{ summary: SessionSummary; badges: string[]; bossPassed?: boolean; xp: number; score: number; maxCombo: number } | null>(null);

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
        <button onClick={onQuit} className="btn-ghost h-9 w-9 !p-0" aria-label={t('quit')}>
          ✕
        </button>
        <div className="flex-1 text-center text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
          {t('learnCard')} · {index + 1}/{total}
        </div>
        <div className="w-9" />
      </div>
      <div key={word.id} className="flex flex-1 animate-pop flex-col items-center justify-center py-8 text-center">
        <div className="card w-full p-8">
          <div className="muted text-xs uppercase tracking-wider">{t(`pos_${word.pos}`)}</div>
          <div className="mt-3 flex items-center justify-center gap-3">
            <GermanWord de={word.de} article={word.article} className="text-4xl font-extrabold tracking-tight sm:text-5xl" />
            <button onClick={() => speak(word.de)} className="text-xl opacity-60 hover:opacity-100" aria-label="Pronounce">
              🔊
            </button>
          </div>
          <div className="mx-auto my-6 h-px w-16 bg-[var(--line)]" />
          <div className="text-xl font-medium leading-relaxed sm:text-2xl">{fullMeaning(word, lang)}</div>
        </div>
      </div>
      <div className="flex gap-3 pb-2">
        {onBack && (
          <button onClick={onBack} className="btn-ghost px-5">
            ←
          </button>
        )}
        <button onClick={onNext} className="btn-primary flex-1 py-3 text-base">
          {last ? t('startCheck') : t('nextCard')} <span className="text-xs opacity-60">↵</span>
        </button>
      </div>
    </div>
  );
}

function Summary({ result, onReplay }: { result: { summary: SessionSummary; badges: string[]; bossPassed?: boolean; xp: number; score: number; maxCombo: number }; onReplay: () => void }) {
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

  const practice = summary.needsPractice.map((id) => wordById(id)).filter((w): w is Word => !!w);

  const go = (c: Parameters<typeof startPlay>[0]) => {
    startPlay(c);
    onReplay();
  };

  return (
    <div className="mx-auto max-w-2xl animate-pop pb-10">
      <div className="py-6 text-center">
        <div className="text-5xl">{boss ? (boss.passed ? '🏆' : '💪') : summary.accuracy >= 0.9 ? '🎉' : summary.accuracy >= 0.7 ? '👏' : '🧠'}</div>
        <h1 className="mt-3 text-2xl font-bold">{t('sessionComplete')}</h1>
        <div className="muted mt-1 text-sm">{config.title}</div>
        {boss && <div className={`mx-auto mt-4 max-w-md rounded-xl border px-4 py-3 text-sm font-medium ${boss.passed ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-amber-300/40 bg-amber-300/10 text-amber-100'}`}>{boss.passed ? t('bossPassed') : t('bossFailed')}</div>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label={t('sessionAccuracy')} value={pct(summary.accuracy)} good={summary.accuracy >= PASS_ACCURACY} />
        <SummaryStat label={t('typingAccuracy')} value={summary.typedAnswered ? pct(summary.typingAccuracy) : '—'} good={summary.typingAccuracy >= PASS_TYPING} />
        <SummaryStat label={t('avgSpeed')} value={summary.avgMs ? `${(summary.avgMs / 1000).toFixed(1)}s` : '—'} />
        <SummaryStat label={t('xpEarned')} value={`+${result.xp}`} accent="text-violet-300" />
        {config.mode.type === 'speed' && (
          <>
            <SummaryStat label={t('finalScore')} value={result.score} accent="text-amber-300" />
            <SummaryStat label={t('maxCombo')} value={`×${result.maxCombo}`} accent="text-violet-300" />
          </>
        )}
      </div>

      {result.badges.length > 0 && (
        <div className="card mt-4 flex flex-wrap items-center gap-3 p-4">
          <span className="text-sm font-semibold text-amber-200">{t('newBadge')}</span>
          {result.badges.map((b) => (
            <span key={b} className="rounded-full bg-amber-300/10 px-3 py-1 text-sm">
              {BADGES.find((x) => x.id === b)?.icon} {t(`badge_${b}` as never)}
            </span>
          ))}
        </div>
      )}

      {mastery && (config.stage === 'boss' || lp?.bossPassed) && (
        <div className="card mt-4 p-4">
          <div className="mb-2 text-sm font-semibold">{t('masteryTitle')}</div>
          <ul className="space-y-1 text-sm">
            {mastery.requirements.map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                <span className={r.met ? 'text-emerald-400' : 'text-[var(--muted)]'}>{r.met ? '✓' : '○'}</span>
                <span className={r.met ? '' : 'muted'}>{t(`req_${r.id}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <WordList title={t('needPractice')} ids={summary.needsPractice} tone="red" />
        <WordList title={t('solidWords')} ids={summary.solid} tone="green" />
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {boss?.passed && level && (() => {
          const nextLevel = buildLevels(level.collectionId, words[level.collectionId] ?? [])[level.index + 1];
          return nextLevel ? (
            <button className="btn-primary flex-1" onClick={() => go(stagePlay(nextLevel, 'learn', collectionName, settings.uiLang))}>
              {t('level')} {nextLevel.index + 1} → {t('stage_learn')}
            </button>
          ) : null;
        })()}
        {next && level && config.stage !== 'boss' && (
          <button className="btn-primary flex-1" onClick={() => go(stagePlay(level, next, collectionName, settings.uiLang))}>
            {t('nextStage')}: {t(`stage_${next}`)} →
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
          {level ? t('backToLevel') : t('home')}
        </button>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, good, accent }: { label: string; value: React.ReactNode; good?: boolean; accent?: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${accent ?? (good === undefined ? '' : good ? 'text-emerald-300' : 'text-amber-200')}`}>{value}</div>
    </div>
  );
}

function WordList({ title, ids, tone }: { title: string; ids: string[]; tone: 'red' | 'green' }) {
  const wordById = useStore((s) => s.wordById);
  const progress = useStore((s) => s.progress);
  const lang = useStore((s) => s.settings.meaningLang);
  if (!ids.length) return null;
  return (
    <div className="card p-4">
      <div className={`mb-2 text-sm font-semibold ${tone === 'red' ? 'text-red-300' : 'text-emerald-300'}`}>
        {title} · {ids.length}
      </div>
      <ul className="max-h-72 space-y-1.5 overflow-auto pr-1">
        {ids.map((id) => {
          const w = wordById(id);
          if (!w) return null;
          return (
            <li key={id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">
                <GermanWord de={w.de} article={w.article} className="font-semibold" /> <span className="muted">— {fullMeaning(w, lang)}</span>
              </span>
              <StateBadge state={memoryState(progress[id])} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
