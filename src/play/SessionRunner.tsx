// Runs one session: shows a question at a time, times it, checks the answer,
// records memory progress, and hands the history back when finished.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QuestionKind, Word } from '../types';
import { useStore, timeLimitMs, DIFFICULTY_TIMERS } from '../store/useStore';
import { useT } from '../lib/i18n';
import { play as sfx } from '../lib/sfx';
import { Timer } from '../components/Timer';
import { UmlautInput } from '../components/UmlautInput';
import { GermanWord, ProgressBar } from '../components/ui';
import { Cross, Struck, Tally, Tick } from '../components/marks';
import { Heart, Lightbulb, Pause, SpeakerHigh, X } from '@phosphor-icons/react';
import { buildQuestion, fullMeaning, meaningText } from '../engine/questions';
import { checkTyped, type Verdict } from '../engine/answer';
import { createRng } from '../engine/rng';
import { LIVES } from '../engine/challenge';
import { letterClue, letterCount, needsClue } from '../engine/clue';
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
  const isChallenge = mode.type === 'challenge';
  const isBoss = mode.type === 'boss';
  const exam = isBoss || isChallenge;
  const timed = mode.type === 'speed' || exam;
  const canPause = !timed;
  // Mutprobe always runs on the Hard timers, whatever the settings say.
  const limitMs = !item ? 0 : isChallenge ? DIFFICULTY_TIMERS.hard[item.kind] * 1000 : timeLimitMs(settings, item.kind, isBoss);
  const [lives, setLives] = useState(LIVES);
  const pool = useMemo(() => (word ? wordsByCollection[word.collectionId] ?? [] : []), [word, wordsByCollection]);
  // Answers are checked against every word, so another word that fits counts.
  const allWords = useMemo(() => Object.values(wordsByCollection).flat(), [wordsByCollection]);

  const question = useMemo(() => {
    if (!item || !word) return null;
    const enc = useStore.getState().progress[word.id]?.encounters ?? 0;
    return buildQuestion(word, item.kind, pool, createRng(session.seed + session.step * 104729), settings, enc + item.attemptNo);
    // Rebuild only when we move to a new step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.step, word?.id]);

  // Letter clue when a word the learner knows (or sees in this session) also
  // shares this meaning, so it is clear which word is wanted.
  const clue = useMemo(() => {
    if (!word || !item || (item.kind !== 'typing' && item.kind !== 'situation')) return null;
    const progress = useStore.getState().progress;
    const known = allWords.filter((w) => progress[w.id]?.encounters || session.wordIds.includes(w.id));
    return needsClue(word, known) ? letterClue(word) : null;
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

  // Phones: while the keyboard is up, use a tighter layout and keep the
  // question and the answer line inside the visible part of the screen.
  const touch = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches, []);
  const [typing, setTyping] = useState(false);
  const compact = touch && typing && !!question?.typed && !feedback;
  const answerRef = useRef<HTMLDivElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();
  // A tap on ä/ö/ü can blur the field for a moment; don't flip the layout for that.
  const onFocusChange = useCallback((focused: boolean) => {
    clearTimeout(blurTimer.current);
    if (focused) setTyping(true);
    else blurTimer.current = setTimeout(() => setTyping(false), 200);
  }, []);
  useEffect(() => () => clearTimeout(blurTimer.current), []);
  useEffect(() => {
    if (!compact) return;
    const vv = window.visualViewport;
    const fit = () => {
      const el = answerRef.current;
      if (!el) return;
      const visible = vv ? vv.height : window.innerHeight;
      const bottom = el.getBoundingClientRect().bottom + window.scrollY;
      // Show as much from the top as fits while the answer line stays in view.
      window.scrollTo({ top: Math.max(0, bottom + 12 - visible), behavior: 'instant' });
    };
    const frame = requestAnimationFrame(fit);
    // The keyboard slides in over ~300 ms; settle again once it is up.
    const timers = [setTimeout(fit, 150), setTimeout(fit, 450)];
    vv?.addEventListener('resize', fit);
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
      vv?.removeEventListener('resize', fit);
    };
  }, [compact, session.step]);

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
        const r = checkTyped(input, word, isChallenge ? { typo: 'strict', difficulty: 'hard', pool: allWords } : { typo: settings.typo, difficulty: settings.difficulty, pool: allWords });
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

      // Another fitting word says nothing about this one; Mutprobe only
      // updates words the learner has met before.
      const recordable = isChallenge ? !!useStore.getState().progress[word.id]?.encounters : true;
      if (!fb.ok && isChallenge) setLives((l) => Math.max(0, l - 1));
      if (fb.verdict !== 'synonym' && recordable) {
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
    [question, word, feedback, paused, limitMs, input, settings, allWords, mode.type, combo, recordAnswer, hint, isChallenge],
  );

  const advance = useCallback(() => {
    if (!feedback || !question) return;
    const ms = feedback.verdict === 'timeout' ? limitMs : Math.min(elapsedRef.current, limitMs);
    setSession((s) => {
      const next = answerCurrent(s, { correct: feedback.ok, ms, limitMs, typed: question.typed });
      // Out of lives: the run ends here.
      return isChallenge && lives === 0 ? { ...next, queue: [] } : next;
    });
    setFeedback(null);
  }, [feedback, question, limitMs, isChallenge, lives]);

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
  const showHintAlways = settings.showSituationHint && !isChallenge;
  const mult = 1 + Math.min(6, Math.floor(combo / 3)) * 0.5;
  const pos = <div className="hand mt-1 text-xl text-pencil">{t(`pos_${word.pos}`)}</div>;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-2xl flex-col">
      {/* HUD */}
      <div className="flex items-center gap-3">
        <button onClick={onQuit} className="btn-ghost h-10 w-10 !p-0" aria-label={t('quit')}>
          <X size={18} weight="bold" />
        </button>
        <div className="flex-1">
          <div className="mb-1.5 flex items-baseline justify-between text-sm font-semibold">
            <span className={exam ? 'text-pen' : 'text-ink'}>{isChallenge ? 'Mutprobe' : isBoss ? t('stage_boss') : t(KIND_LABEL[item.kind] as never)}</span>
            <span className="text-pencil">
              {prog.done}/{prog.total}
            </span>
          </div>
          <ProgressBar value={prog.done / Math.max(1, prog.total)} color={exam ? 'bg-pen' : 'bg-blue'} />
        </div>
        {isChallenge && (
          <span className="flex gap-0.5 text-pen" role="img" aria-label={t('livesLeft', { n: lives })}>
            {Array.from({ length: LIVES }, (_, i) => (
              <Heart key={i} size={18} weight={i < lives ? 'fill' : 'bold'} className={i < lives ? '' : 'opacity-30'} />
            ))}
          </span>
        )}
        {canPause ? (
          <button onClick={() => setPaused(true)} className="btn-ghost h-10 w-10 !p-0" aria-label={t('pause')} title={t('pause')}>
            <Pause size={18} weight="bold" />
          </button>
        ) : null}
        <Timer limitMs={limitMs} running={!feedback && !paused} resetKey={session.step} elapsedRef={elapsedRef} onTimeout={() => submit(undefined, true)} onTick={(s) => s <= 3 && s > 0 && timed && sfx('tick', settings.sound)} />
      </div>

      {mode.type === 'speed' && (
        <div className="mt-4 flex min-h-[44px] items-center justify-between border-b border-dashed border-line pb-2">
          <span className="text-sm font-semibold text-pencil">
            {t('score')} <span className="hand ml-1 text-2xl font-bold text-blue">{score}</span>
          </span>
          <span className="flex items-center gap-2">
            {combo > 0 ? <Tally count={combo} /> : <span className="text-sm text-pencil">{t('combo')}</span>}
            {combo >= 3 && <span className="hand text-xl font-bold text-pen">×{mult.toFixed(1)}</span>}
          </span>
        </div>
      )}

      {/* Question */}
      <div key={session.step} className={`flex flex-1 animate-pop flex-col ${compact ? 'justify-start py-3' : 'justify-center py-8'}`}>
        <div className={`text-center ${compact ? 'mb-4' : 'mb-8'}`}>
          {item.kind === 'meaning' && (
            <>
              <div className="mb-3 text-[15px] text-pencil">{t('whatMeans')}</div>
              <GermanWord de={word.de} article={word.article} className="text-[42px] font-bold leading-tight tracking-tight sm:text-[54px]" />
              {pos}
            </>
          )}
          {(item.kind === 'reverse' || (item.kind === 'speed' && !question.typed)) && (
            <>
              <div className="mb-3 text-[15px] text-pencil">{item.kind === 'speed' ? t('speedQ') : t('whichGerman')}</div>
              <div className="text-[30px] font-bold leading-tight sm:text-[38px]">{meaningText(word, settings.meaningLang, 4)}</div>
              {pos}
            </>
          )}
          {(item.kind === 'typing' || (item.kind === 'speed' && question.typed)) && (
            <>
              <div className="mb-3 text-[15px] text-pencil">{word.article ? t('typeWithArticle') : t('typeGerman')}</div>
              <div className="text-[30px] font-bold leading-tight sm:text-[38px]">{meaningText(word, settings.meaningLang, 4)}</div>
              {pos}
              {clue && !feedback && <Clue marks={clue} count={letterCount(word)} />}
            </>
          )}
          {item.kind === 'situation' && (
            <>
              <div className={`text-[15px] text-pencil ${compact ? 'mb-2' : 'mb-3'}`}>{t('situationQ')}</div>
              <div className={`card mx-auto max-w-xl -rotate-[0.6deg] text-left ${compact ? 'px-4 py-3 text-[17px] leading-snug' : 'px-6 py-5 text-[19px] leading-relaxed sm:text-xl'}`}>{question.situation}</div>
              {clue && !feedback && <Clue marks={clue} count={letterCount(word)} />}
              <div className={`flex items-center justify-center gap-3 ${compact ? 'mt-2' : 'mt-4'}`}>
                <span className="hand text-xl text-pencil">{t(`pos_${word.pos}`)}</span>
                {isChallenge ? null : showHintAlways || hint ? (
                  <span className="rounded-[3px] bg-marker/60 px-1.5 text-[15px] font-semibold text-ink">{meaningText(word, settings.meaningLang, 4)}</span>
                ) : (
                  !feedback && (
                    <button onClick={() => setHint(true)} className="flex items-center gap-1 text-sm font-semibold text-pencil underline decoration-dotted underline-offset-4 hover:text-ink" title={t('hintCost')}>
                      <Lightbulb size={16} weight="bold" aria-hidden /> {t('showHint')}
                    </button>
                  )
                )}
              </div>
            </>
          )}
        </div>

        {question.options ? (
          <ol className="grid gap-2.5 sm:grid-cols-2">
            {question.options.map((o, i) => {
              const isRight = i === question.correctIndex;
              const isChosen = feedback?.chosen === i;
              const style = !feedback
                ? 'border-line bg-sheet hover:border-blue/60 hover:shadow-lift'
                : isRight
                  ? 'border-ok bg-ok-soft'
                  : isChosen
                    ? 'border-pen/60 bg-sheet animate-shake'
                    : 'border-line bg-sheet opacity-45';
              const optWord = item.kind === 'meaning' ? undefined : wordById(o.wordId);
              const label = optWord ? <GermanWord de={o.text} article={optWord.article} /> : o.text;
              return (
                <li key={o.wordId}>
                  <button disabled={!!feedback} onClick={() => submit(i)} className={`flex min-h-[64px] w-full items-center gap-3 rounded-sheet border px-4 py-3 text-left shadow-sheet transition-[border-color,box-shadow,opacity] ${style}`}>
                    <span className="hand w-6 shrink-0 text-xl font-bold text-pencil">{String.fromCharCode(97 + i)})</span>
                    <span className="flex-1 text-[17px] font-semibold sm:text-lg">{feedback && isChosen && !isRight ? <Struck>{label}</Struck> : label}</span>
                    {feedback && isRight && <Tick size={30} />}
                    {feedback && isChosen && !isRight && <Cross size={26} />}
                  </button>
                </li>
              );
            })}
          </ol>
        ) : feedback ? (
          <div className="mx-auto w-full max-w-md text-center">
            <div className="flex items-center justify-center gap-2 border-b-2 border-line pb-1">
              {feedback.typed ? (
                feedback.ok ? (
                  <span className="hand text-[32px] text-blue sm:text-4xl">{feedback.typed}</span>
                ) : (
                  <Struck className="hand text-[32px] text-blue sm:text-4xl">{feedback.typed}</Struck>
                )
              ) : (
                <span className="hand text-[32px] text-pencil/50">…</span>
              )}
              {feedback.ok ? <Tick size={32} tone={feedback.verdict === 'correct' ? 'ok' : 'pen'} /> : <Cross size={28} />}
            </div>
            {feedback.verdict !== 'correct' && feedback.verdict !== 'synonym' && (
              <div className="hand mt-2 -rotate-1 text-[30px] font-bold leading-tight text-pen">
                <GermanWord de={word.de} article={word.article} className="[&>span]:!text-pen" />
              </div>
            )}
          </div>
        ) : (
          <div ref={answerRef} className="mx-auto w-full max-w-md">
            <UmlautInput ref={inputRef} value={input} onChange={setInput} onSubmit={() => submit()} disabled={false} state="idle" placeholder="…" onFocusChange={onFocusChange} compact={compact} submitLabel={t('submit')} />
            {!compact && (
              <button onClick={() => submit()} disabled={!input.trim()} className="btn-primary mt-5 w-full py-3 text-base">
                {t('submit')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`animate-pop rounded-sheet border p-4 shadow-lift ${feedback.ok ? 'border-ok/35 bg-ok-soft' : 'border-pen/35 bg-pen-soft'}`}>
          <div className="flex items-baseline justify-between gap-3">
            <div className={`hand text-2xl font-bold ${feedback.ok ? 'text-ok' : 'text-pen'}`}>{feedback.verdict === 'timeout' ? t('timeUp') : feedback.ok ? t('correct') : t('wrong')}</div>
            {feedback.xp > 0 && <span className="hand text-xl font-bold text-blue">+{feedback.xp} XP</span>}
          </div>
          {feedback.verdict === 'typo' && <div className="mt-1 text-[15px]">{t('typoNote')}</div>}
          {feedback.verdict === 'article' && <div className="mt-1 text-[15px]">{feedback.givenArticle ? t('articleWrong') : t('articleMissing')}</div>}
          {feedback.verdict === 'synonym' && (
            <div className="mt-1 text-[15px]">
              <b>{feedback.matched?.de}</b> {t('synonymNote')}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-lg">
            <GermanWord de={word.de} article={word.article} className="font-bold" />
            <button onClick={() => speak(word.de)} className="grid h-8 w-8 place-items-center rounded-full text-pencil hover:bg-ink/5 hover:text-ink" aria-label={t('pronounce')}>
              <SpeakerHigh size={18} weight="bold" />
            </button>
            <span className="text-[15px] text-pencil">{meaning}</span>
          </div>
          {!feedback.ok && !timed && (
            <button ref={continueRef} onClick={advance} className="btn-primary mt-4 w-full">
              {t('continue')}
            </button>
          )}
        </div>
      )}

      {paused && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-paper/90 backdrop-blur-sm">
          <div className="text-center">
            <div className="hand mb-6 text-4xl font-bold text-blue">{t('paused')}</div>
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

/** "G _ _ _ _ _ _ (7)": first letter and one line per letter. */
function Clue({ marks, count }: { marks: (string | null)[]; count: number }) {
  const t = useT();
  return (
    <div className="mt-3 flex flex-wrap items-end justify-center gap-1" role="note" aria-label={t('clueLabel', { letter: marks[0] ?? '', n: count })}>
      {marks.map((m, i) =>
        m === ' ' ? (
          <span key={i} className="w-2.5" />
        ) : m && i > 0 ? (
          <span key={i} className="hand px-0.5 text-xl font-bold leading-none text-pencil">{m}</span>
        ) : (
          <span key={i} className={`hand grid h-7 w-4 place-items-end justify-center border-b-2 pb-0.5 text-[22px] font-bold leading-none ${m ? 'border-blue text-blue' : 'border-pencil/40'}`}>
            {m ?? ''}
          </span>
        ),
      )}
      <span className="ml-1.5 text-sm text-pencil" aria-hidden>({count})</span>
    </div>
  );
}
