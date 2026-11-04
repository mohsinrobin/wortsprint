import { CaretDown } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import type { QuestionKind, Settings } from '../types';
import { useStore, DIFFICULTY_TIMERS } from '../store/useStore';
import { useT } from '../lib/i18n';
import { PageHeader, Segmented, Toggle } from '../components/ui';
import { setThemePref, useTheme, type ThemePref } from '../lib/theme';
import { LOOKS, LOOK_NAME, setLook, useLook, type Look } from '../lib/look';
import { navigate } from '../lib/router';

const KINDS: QuestionKind[] = ['meaning', 'reverse', 'typing', 'situation', 'speed'];

export function SettingsScreen() {
  const t = useT();
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const resetProgress = useStore((s) => s.resetProgress);
  const { pref } = useTheme();
  const look = useLook();

  const setTimer = (k: QuestionKind, v: number) => update({ timers: { ...settings.timers, [k]: Math.max(2, Math.min(60, v || DIFFICULTY_TIMERS[settings.difficulty][k])) } });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('settings')} />

      <Section title={t('lookSection')}>
        <div className="grid grid-cols-2 gap-3">
          {LOOKS.map((l) => (
            <button
              key={l}
              onClick={() => setLook(l)}
              aria-pressed={look === l}
              className={`overflow-hidden rounded-sheet border-2 bg-sheet text-left transition-colors ${look === l ? 'border-blue' : 'border-line hover:border-pencil/50'}`}
            >
              <ThemeSwatch look={l} />
              <span className="block px-3 pb-3 pt-2">
                <span className="block font-semibold">{LOOK_NAME[l]}</span>
                <span className="block text-sm text-pencil">{t(`themeDesc_${l}`)}</span>
              </span>
            </button>
          ))}
        </div>
        <Field label={t('appearance')}>
          <Segmented<ThemePref> value={pref} onChange={setThemePref} options={(['system', 'light', 'dark'] as const).map((v) => ({ value: v, label: t(`theme_${v}`) }))} />
        </Field>
      </Section>

      <Section title={t('practiceSection')}>
        <Field label={t('difficulty')} help={t('diffHelp')}>
          <Segmented<Settings['difficulty']>
            value={settings.difficulty}
            onChange={(v) => update({ difficulty: v, timers: { ...DIFFICULTY_TIMERS[v] } })}
            options={(['easy', 'normal', 'hard', 'extreme'] as const).map((d) => ({ value: d, label: t(`diff_${d}`) }))}
          />
        </Field>
        <Field label={`${t('reviewSize')}: ${settings.reviewSize}`}>
          <input type="range" min={10} max={100} step={5} value={settings.reviewSize} onChange={(e) => update({ reviewSize: Number(e.target.value) })} className="w-full accent-[rgb(var(--c-blue))]" aria-label={t('reviewSize')} />
        </Field>
        <div className="divide-y divide-line">
          <div className="pb-3">
            <Toggle label={t('sound')} checked={settings.sound} onChange={(v) => update({ sound: v })} />
          </div>
          <div className="pt-3">
            <Toggle label={t('situationHint')} checked={settings.showSituationHint} onChange={(v) => update({ showSituationHint: v })} />
          </div>
        </div>
      </Section>

      <details className="card group mb-8 overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-lg font-semibold">{t('advancedSection')}</span>
            <span className="block text-sm text-pencil">{t('advancedHelp')}</span>
          </span>
          <CaretDown size={18} weight="bold" className="shrink-0 text-pencil transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-5 border-t border-line px-5 pb-5 pt-4">
          <Field label={t('timers')}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {KINDS.map((k) => (
                <label key={k} className="block">
                  <span className="mb-1 block text-sm text-pencil">{t(`timer_${k}`)}</span>
                  <input type="number" inputMode="numeric" min={2} max={60} value={settings.timers[k]} onChange={(e) => setTimer(k, Number(e.target.value))} className="input tabular-nums" />
                </label>
              ))}
            </div>
          </Field>
          <Field label={t('typoTolerance')}>
            <Segmented<Settings['typo']> value={settings.typo} onChange={(v) => update({ typo: v })} options={(['off', 'strict', 'lenient'] as const).map((d) => ({ value: d, label: t(`typo_${d}`) }))} />
          </Field>
          <Field label={t('retryGap')}>
            <Segmented<Settings['retryGap']> value={settings.retryGap} onChange={(v) => update({ retryGap: v })} options={(['immediate', 'later'] as const).map((d) => ({ value: d, label: t(`retry_${d}`) }))} />
          </Field>
          <Field label={t('speedInput')}>
            <Segmented<Settings['speedInput']> value={settings.speedInput} onChange={(v) => update({ speedInput: v })} options={(['choice', 'typing'] as const).map((d) => ({ value: d, label: t(`speed_${d}`) }))} />
          </Field>
          <Field label={t('practiceScope')}>
            <Segmented<Settings['practiceScope']> value={settings.practiceScope} onChange={(v) => update({ practiceScope: v })} options={(['all', 'selected'] as const).map((d) => ({ value: d, label: t(`scope_${d}`) }))} />
          </Field>
        </div>
      </details>

      <Section title={t('progressSection')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-sm text-[15px] text-pencil">{t('resetHelp')}</p>
          <button
            className="btn-danger"
            onClick={async () => {
              if (window.confirm(t('resetConfirm'))) await resetProgress();
            }}
          >
            {t('resetProgress')}
          </button>
        </div>
      </Section>

      <p className="flex justify-center gap-5 pb-2 text-sm text-pencil">
        <button onClick={() => navigate('/privacy')} className="underline underline-offset-2 hover:text-ink">
          {t('privacy')}
        </button>
      </p>
    </div>
  );
}

/** A small picture of each theme, so the choice is visual rather than a name. */
function ThemeSwatch({ look }: { look: Look }) {
  if (look === 'bahn')
    return (
      <span className="flex h-20 items-center gap-2 bg-[#0C2556] px-3" aria-hidden>
        <span className="flex-1 space-y-1.5">
          <span className="block h-1.5 w-10 rounded-full bg-[#FFD300]" />
          <span className="block h-3 w-20 rounded-sm bg-white" />
          <span className="block h-1.5 w-14 rounded-full bg-white/50" />
        </span>
        <span className="grid h-11 w-9 place-items-center rounded-[3px] bg-[#FFD300] text-sm font-bold text-[#0C2556]">3</span>
      </span>
    );
  return (
    <span className="relative block h-20 bg-[#EEEFEA] bg-[linear-gradient(#DCE1E4_1px,transparent_1px),linear-gradient(90deg,#DCE1E4_1px,transparent_1px)] bg-[length:10px_10px]" aria-hidden>
      <span className="absolute inset-x-3 top-3 block rounded-[3px] bg-white px-2 py-1.5 shadow-sm">
        <span className="block h-2 w-16 rounded-full bg-[#2A46B0]" />
        <span className="mt-1.5 block h-px bg-[#B42838]/60" />
        <span className="mt-1.5 block h-1.5 w-20 rounded-full bg-[#5A6172]/40" />
      </span>
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      <div className="card space-y-5 p-5">{children}</div>
    </section>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      {children}
      {help && <div className="mt-1.5 text-sm text-pencil">{help}</div>}
    </div>
  );
}
