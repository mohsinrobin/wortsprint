// Runs one session: shows a question at a time, times it, checks the answer,
// records memory progress, and hands the history back when finished.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QuestionKind, Word } from '../types';
import { useStore, timeLimitMs } from '../store/useStore';
import { useT } from '../lib/i18n';
import { play as sfx } from '../lib/sfx';
import { Timer } from '../components/Timer';
import { UmlautInput } from '../components/UmlautInput';
import { GermanWord, ProgressBar } from '../components/ui';
import { buildQuestion, fullMeaning, meaningText } from '../engine/questions';
import { checkTyped, type Verdict } from '../engine/answer';
import { createRng } from '../engine/rng';
import { nextKindFor, speedOf } from '../engine/srs';
import { xpFor } from '../engine/stats';
import { answerCurrent, createSession, currentItem, isFinished, sessionProgress, type AnswerRecord, type SessionMode } from '../engine/session';
import { speak } from './speak';

export interface RunnerResult {
  history: AnswerRecord[];
  xp: number;
  score: number;
  maxCombo: number;
}

interface Props {
  mode: SessionMode;
  wordIds: string[];
  extra?: string[];
  onDone: (r: RunnerResult) => void;
  onQuit: () => void;
}

interface Feedback {
  ok: boolean;
  verdict: Verdict | 'timeout' | 'choice';
  chosen?: number;
  typed?: string;
  matched?: Word;
  givenArticle?: string | null;
  xp: number;
}

const KIND_LABEL: Record<QuestionKind, string> = {
  meaning: 'stage_recognize',
  reverse: 'stage_reverse',
  typing: 'stage_recall',
  situation: 'stage_situations',
  speed: 'speedChallenge',
};

export function SessionRunner({ mode, wordIds, extra, onDone, onQuit }: Props) {
  const t = useT();
  const settings = useStore((s) => s.settings);
  const wordsByCollection = useStore((s) => s.words);
  const recordAnswer = useStore((s) => s.recordAnswer);
  const wordById = useStore((s) => s.wordById);

  const [session, setSession] = useState(() => {
    const progress = useStore.getState().progress;
    return createSession({
      mode,
      wordIds,
      extra,
      seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0,
      retryGap: settings.retryGap,
      kindFor: (id, roll) => nextKindFor(progress[id], roll),
    });
  });
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [input, setInput] = useState('');
  const [paused, setPaused] = useState(false);
  const [hint, setHint] = useState(false);
  const [xp, setXp] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const elapsedRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  const item = currentItem(session);
  const word = item ? wordById(item.wordId) : undefined;
  const isBoss = mode.type === 'boss';
  const timed = mode.type === 'speed' || isBoss;
  const canPause = !timed;
  const limitMs = item ? timeLimitMs(settings, item.kind, isBoss) : 0;
  const pool = useMemo(() => (word ? wordsByCollection[word.collectionId] ?? [] : []), [word, wordsByCollection]);

  const question = useMemo(() => {
    if (!item || !word) return null;
    const enc = useStore.getState().progress[word.id]?.encounters ?? 0;
    return buildQuestion(word, item.kind, pool, createRng(session.seed + session.step * 104729), settings, enc + item.attemptNo);
    // Rebuild only when we move to a new step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.step, word?.id]);

  // Dev-only hook for automated QA of the game flow.
  if (import.meta.env.DEV) (window as unknown as { __wsQuestion?: unknown }).__wsQuestion = question;

  // Skip items whose word was deleted meanwhile.
  useEffect(() => {
    if (item && !word) setSession((s) => ({ ...s, queue: s.queue.slice(1) }));
  }, [item, word]);

  useEffect(() => {
    if (isFinished(session)) onDone({ history: session.history, xp, score, maxCombo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    setInput('');
    setHint(false);
    if (question?.typed) requestAnimationFrame(() => inputRef.current?.focus());
  }, [question]);

  const submit = useCallback(
    (choice?: number, timeout = false) => {
      if (!question || !word || feedback || paused) return;
      const ms = timeout ? limitMs : Math.min(elapsedRef.current, limitMs);
      let fb: Feedback;
      if (timeout) {
        fb = { ok: false, verdict: 'timeout', typed: question.typed ? input : undefined, xp: 0 };
      } else if (question.typed) {
        if (!input.trim()) return;
        const r = checkTyped(input, word, { typo: settings.typo, difficulty: settings.difficulty, pool });
        fb = { ok: r.ok, verdict: r.verdict, typed: input, matched: r.matched, givenArticle: r.givenArticle, xp: 0 };
      } else {
        fb = { ok: choice === question.correctIndex, verdict: 'choice', chosen: choice, xp: 0 };
      }

      const fast = speedOf(ms, limitMs) === 'fast';
      let mult = 1;
      if (mode.type === 'speed') {
        const nextCombo = fb.ok ? combo + 1 : 0;
        mult = 1 + Math.min(6, Math.floor(nextCombo / 3)) * 0.5;
        setCombo(nextCombo);
        setMaxCombo((m) => Math.max(m, nextCombo));
        if (fb.ok) {
          const bonus = nextCombo > 0 && nextCombo % 5 === 0 ? 50 * mult : 0;
          setScore((s) => s + Math.round(100 * mult * (1 + (1 - ms / limitMs))) + bonus);
          if (bonus) sfx('combo', settings.sound);
        }
      }
      // Score uses the full combo multiplier; XP caps it so speed rounds don't dwarf recall work.
      fb.xp = xpFor(question.kind, fb.ok, fast, Math.min(mult, 2));
      setXp((x) => x + fb.xp);

      // A synonym from the user's list is not a memory failure: no penalty.
      if (fb.verdict !== 'synonym') {
        recordAnswer(word.id, {
          correct: fb.ok,
          kind: question.kind,
          ms,
          limitMs,
          typed: question.typed,
          assisted: fb.verdict === 'typo' || (hint && !settings.showSituationHint),
        });
      }
      sfx(fb.ok ? 'correct' : 'wrong', settings.sound);
      setFeedback(fb);
    },
    [question, word, feedback, paused, limitMs, input, settings, pool, mode.type, combo, recordAnswer, hint],
  );

  const advance = useCallback(() => {
    if (!feedback || !question) return;
    const ms = feedback.verdict === 'timeout' ? limitMs : Math.min(elapsedRef.current, limitMs);
    setSession((s) => answerCurrent(s, { correct: feedback.ok, ms, limitMs, typed: question.typed }));
    setFeedback(null);
  }, [feedback, question, limitMs]);

  // Auto-advance: quickly after correct answers; timed modes also after misses.
  useEffect(() => {
    if (!feedback) return;
    if (feedback.ok || timed) {
      const delay = feedback.ok ? (mode.type === 'speed' ? 450 : feedback.verdict === 'typo' ? 1600 : 750) : 1600;
      const id = setTimeout(advance, delay);
      return () => clearTimeout(id);
    }
    requestAnimationFrame(() => continueRef.current?.focus());
  }, [feedback, timed, advance, mode.type]);

  // Keyboard: 1–4 / A–D choose, Enter continues, Escape pauses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && canPause) {
        setPaused((p) => !p);
        return;
      }
      if (paused) return;
      if (feedback && e.key === 'Enter') {
        e.preventDefault();
        advance();
        return;
      }
      if (!feedback && question?.options) {
        const idx = ['1', '2', '3', '4'].indexOf(e.key) >= 0 ? Number(e.key) - 1 : ['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase());
        if (idx >= 0 && idx < question.options.length) submit(idx);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [feedback, question, submit, advance, paused, canPause]);

  if (!question || !word || !item) return null;
  const prog = sessionProgress(session);
  const meaning = fullMeaning(word, settings.meaningLang);
  const showHintAlways = settings.showSituationHint;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-2xl flex-col">
      {/* HUD */}
      <div className="flex items-center gap-3">
        <button onClick={onQuit} className="btn-ghost h-9 w-9 !p-0" aria-label={t('quit')}>
          ✕
        </button>
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
            <span>{isBoss ? t('stage_boss') : t(KIND_LABEL[item.kind] as never)}</span>
            <span className="tabular-nums">
              {prog.done}/{prog.total}
            </span>
          </div>
          <ProgressBar value={prog.done / Math.max(1, prog.total)} color={isBoss ? 'bg-violet-400' : 'bg-emerald-400'} />
        </div>
        {canPause ? (
          <button onClick={() => setPaused(true)} className="btn-ghost h-9 w-9 !p-0" aria-label={t('pause')} title={t('pause')}>
            ❚❚
          </button>
        ) : null}
        <Timer limitMs={limitMs} running={!feedback && !paused} resetKey={session.step} elapsedRef={elapsedRef} onTimeout={() => submit(undefined, true)} onTick={(s) => s <= 3 && s > 0 && timed && sfx('tick', settings.sound)} />
      </div>

      {mode.type === 'speed' && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm">
          <span>
            {t('score')} <b className="tabular-nums text-amber-300">{score}</b>
          </span>
          <span className={combo >= 3 ? 'animate-pop font-bold text-violet-300' : 'muted'}>
            {t('combo')} ×{combo} {combo >= 3 && <span className="ml-1 text-xs">({(1 + Math.min(6, Math.floor(combo / 3)) * 0.5).toFixed(1)}x)</span>}
          </span>
        </div>
      )}

      {/* Question */}
      <div key={session.step} className="flex flex-1 animate-pop flex-col justify-center py-6">
        <div className="mb-6 text-center">
          {item.kind === 'meaning' && (
            <>
              <div className="muted mb-3 text-sm">{t('whatMeans')}</div>
              <div className="flex items-center justify-center gap-2">
                <GermanWord de={word.de} article={word.article} className="text-4xl font-extrabold tracking-tight sm:text-5xl" />
              </div>
              <div className="muted mt-2 text-xs uppercase tracking-wider">{t(`pos_${word.pos}`)}</div>
            </>
          )}
          {(item.kind === 'reverse' || (item.kind === 'speed' && !question.typed)) && (
            <>
              <div className="muted mb-3 text-sm">{item.kind === 'speed' ? t('speedQ') : t('whichGerman')}</div>
              <div className="text-3xl font-bold leading-tight sm:text-4xl">{meaningText(word, settings.meaningLang, 4)}</div>
              <div className="muted mt-2 text-xs uppercase tracking-wider">{t(`pos_${word.pos}`)}</div>
            </>
          )}
          {(item.kind === 'typing' || (item.kind === 'speed' && question.typed)) && (
            <>
              <div className="muted mb-3 text-sm">{word.article ? t('typeWithArticle') : t('typeGerman')}</div>
              <div className="text-3xl font-bold leading-tight sm:text-4xl">{meaningText(word, settings.meaningLang, 4)}</div>
              <div className="muted mt-2 text-xs uppercase tracking-wider">{t(`pos_${word.pos}`)}</div>
            </>
          )}
          {item.kind === 'situation' && (
            <>
              <div className="muted mb-3 text-sm">{t('situationQ')}</div>
              <div className="card mx-auto max-w-xl p-5 text-left text-lg leading-relaxed sm:text-xl">“{question.situation}”</div>
              <div className="mt-3 flex items-center justify-center gap-3 text-xs">
                <span className="muted uppercase tracking-wider">{t(`pos_${word.pos}`)}</span>
                {showHintAlways || hint ? (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[var(--ink)]">{meaningText(word, settings.meaningLang, 4)}</span>
                ) : (
                  !feedback && (
                    <button onClick={() => setHint(true)} className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[var(--muted)] hover:text-[var(--ink)]" title={t('hintCost')}>
                      💡 {t('showHint')}
                    </button>
                  )
                )}
              </div>
            </>
          )}
        </div>

        {question.options ? (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {question.options.map((o, i) => {
              const isRight = i === question.correctIndex;
              const isChosen = feedback?.chosen === i;
              const style = !feedback
                ? 'border-[var(--line)] hover:border-emerald-400/60 hover:bg-white/[0.03]'
                : isRight
                  ? 'border-emerald-400 bg-emerald-400/15'
                  : isChosen
                    ? 'border-red-400 bg-red-400/15 animate-shake'
                    : 'border-[var(--line)] opacity-50';
              const optWord = item.kind === 'meaning' ? undefined : wordById(o.wordId);
              return (
                <button key={o.wordId} disabled={!!feedback} onClick={() => submit(i)} className={`flex min-h-[64px] items-center gap-3 rounded-2xl border-2 bg-[var(--surface)] px-4 py-3 text-left transition ${style}`}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 text-xs font-bold text-[var(--muted)]">{String.fromCharCode(65 + i)}</span>
                  <span className="text-base font-medium sm:text-lg">{optWord ? <GermanWord de={o.text} article={optWord.article} /> : o.text}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mx-auto w-full max-w-md">
            <UmlautInput
              ref={inputRef}
              value={input}
              onChange={setInput}
              onSubmit={() => (feedback ? advance() : submit())}
              disabled={!!feedback}
              state={feedback ? (feedback.ok ? 'correct' : 'wrong') : 'idle'}
              placeholder="…"
            />
            {!feedback && (
              <button onClick={() => submit()} disabled={!input.trim()} className="btn-primary mt-4 w-full py-3 text-base">
                {t('submit')} <span className="text-xs opacity-60">↵</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`animate-pop rounded-2xl border p-4 ${feedback.ok ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-red-400/40 bg-red-400/10'}`}>
          <div className="flex items-start gap-3">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg font-bold ${feedback.ok ? 'bg-emerald-400 text-[#06281c]' : 'bg-red-400 text-[#2a0909]'}`}>{feedback.ok ? '✓' : '✕'}</div>
            <div className="min-w-0 flex-1">
              <div className={`font-bold ${feedback.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                {feedback.verdict === 'timeout' ? t('timeUp') : feedback.ok ? t('correct') : t('wrong')}
                {feedback.xp > 0 && <span className="ml-2 text-xs font-semibold text-violet-300">+{feedback.xp} XP</span>}
              </div>
              {feedback.verdict === 'typo' && <div className="mt-1 text-sm">{t('typoNote')}</div>}
              {feedback.verdict === 'article' && <div className="mt-1 text-sm">{feedback.givenArticle ? t('articleWrong') : t('articleMissing')}</div>}
              {feedback.verdict === 'synonym' && (
                <div className="mt-1 text-sm">
                  “{feedback.matched?.de}” — {t('synonymNote')}
                </div>
              )}
              {!feedback.ok && feedback.typed && feedback.verdict !== 'article' && feedback.verdict !== 'synonym' && (
                <div className="mt-1 text-sm">
                  <span className="muted">{t('youChose')} </span>
                  <span className="line-through opacity-80">{feedback.typed || '—'}</span>
                </div>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-lg">
                <GermanWord de={word.de} article={word.article} className="font-bold" />
                <button onClick={() => speak(word.de)} className="text-sm opacity-60 hover:opacity-100" aria-label="Pronounce">
                  🔊
                </button>
                <span className="muted text-sm">— {meaning}</span>
              </div>
            </div>
          </div>
          {!feedback.ok && !timed && (
            <button ref={continueRef} onClick={advance} className="btn-ghost mt-3 w-full">
              {t('continue')} <span className="text-xs opacity-60">↵</span>
            </button>
          )}
        </div>
      )}

      {paused && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0b0d12]/90 backdrop-blur-md">
          <div className="text-center">
            <div className="mb-6 text-2xl font-bold">{t('paused')}</div>
            <div className="flex gap-3">
              <button onClick={() => setPaused(false)} className="btn-primary px-6">
                {t('resume')}
              </button>
              <button onClick={onQuit} className="btn-ghost px-6">
                {t('quit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
