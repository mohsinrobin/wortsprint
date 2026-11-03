import { useRef, useState } from 'react';
import type { QuestionKind, Settings } from '../types';
import { useStore, DEFAULT_SETTINGS } from '../store/useStore';
import { useT } from '../lib/i18n';
import { PageHeader, Segmented, Toggle } from '../components/ui';

const KINDS: QuestionKind[] = ['meaning', 'reverse', 'typing', 'situation', 'speed'];

export function SettingsScreen() {
  const t = useT();
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const exportBackup = useStore((s) => s.exportBackup);
  const importBackup = useStore((s) => s.importBackup);
  const resetProgress = useStore((s) => s.resetProgress);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  const download = () => {
    const blob = new Blob([exportBackup()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wortsprint-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const restore = async (f: File) => {
    try {
      await importBackup(await f.text());
      setMsg(t('backupRestored'));
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const setTimer = (k: QuestionKind, v: number) => update({ timers: { ...settings.timers, [k]: Math.max(2, Math.min(60, v || DEFAULT_SETTINGS.timers[k])) } });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t('settings')} />

      <Card>
        <Row label={t('interfaceLang')}>
          <Segmented<Settings['uiLang']> value={settings.uiLang} onChange={(v) => update({ uiLang: v })} options={[{ value: 'en', label: 'English' }, { value: 'bn', label: 'বাংলা' }]} />
        </Row>
        <Row label={t('meaningLang')} help={t('meaningLangHelp')}>
          <Segmented<Settings['meaningLang']> value={settings.meaningLang} onChange={(v) => update({ meaningLang: v })} options={[{ value: 'en', label: 'English' }, { value: 'bn', label: 'বাংলা' }]} />
        </Row>
      </Card>

      <Card>
        <Row label={t('difficulty')} help={t('diffHelp')}>
          <Segmented<Settings['difficulty']>
            value={settings.difficulty}
            onChange={(v) => update({ difficulty: v })}
            options={(['easy', 'normal', 'hard', 'extreme'] as const).map((d) => ({ value: d, label: t(`diff_${d}`) }))}
          />
        </Row>
        <div>
          <div className="label">{t('timers')}</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {KINDS.map((k) => (
              <label key={k} className="block">
                <span className="mb-1 block text-xs text-[var(--muted)]">{t(`timer_${k}`)}</span>
                <input type="number" min={2} max={60} value={settings.timers[k]} onChange={(e) => setTimer(k, Number(e.target.value))} className="input tabular-nums" />
              </label>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <Row label={t('typoTolerance')}>
          <Segmented<Settings['typo']> value={settings.typo} onChange={(v) => update({ typo: v })} options={(['off', 'strict', 'lenient'] as const).map((d) => ({ value: d, label: t(`typo_${d}`) }))} />
        </Row>
        <Row label={t('retryGap')}>
          <Segmented<Settings['retryGap']> value={settings.retryGap} onChange={(v) => update({ retryGap: v })} options={(['immediate', 'later'] as const).map((d) => ({ value: d, label: t(`retry_${d}`) }))} />
        </Row>
        <Row label={t('speedInput')}>
          <Segmented<Settings['speedInput']> value={settings.speedInput} onChange={(v) => update({ speedInput: v })} options={(['choice', 'typing'] as const).map((d) => ({ value: d, label: t(`speed_${d}`) }))} />
        </Row>
        <Row label={t('practiceScope')}>
          <Segmented<Settings['practiceScope']> value={settings.practiceScope} onChange={(v) => update({ practiceScope: v })} options={(['all', 'selected'] as const).map((d) => ({ value: d, label: t(`scope_${d}`) }))} />
        </Row>
        <Row label={`${t('reviewSize')}: ${settings.reviewSize}`}>
          <input type="range" min={10} max={100} step={5} value={settings.reviewSize} onChange={(e) => update({ reviewSize: Number(e.target.value) })} className="w-full accent-emerald-400" />
        </Row>
        <Toggle label={t('situationHint')} checked={settings.showSituationHint} onChange={(v) => update({ showSituationHint: v })} />
        <Toggle label={t('sound')} checked={settings.sound} onChange={(v) => update({ sound: v })} />
      </Card>

      <Card>
        <div className="font-semibold">{t('backup')}</div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={download}>
            ⬇ {t('exportBackup')}
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
            ⬆ {t('importBackup')}
          </button>
          <button
            className="btn-danger ml-auto"
            onClick={async () => {
              if (window.confirm(t('resetConfirm'))) await resetProgress();
            }}
          >
            {t('resetProgress')}
          </button>
        </div>
        {msg && <div className="text-sm text-emerald-300">{msg}</div>}
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="card space-y-4 p-5">{children}</section>;
}

function Row({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      {children}
      {help && <div className="mt-1.5 text-xs text-[var(--muted)]">{help}</div>}
    </div>
  );
}
