import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { navigate, useRoute } from './lib/router';
import { useT } from './lib/i18n';
import { Dashboard } from './screens/Dashboard';
import { Library } from './screens/Library';
import { CollectionView } from './screens/CollectionView';
import { LevelView } from './screens/LevelView';
import { SettingsScreen } from './screens/Settings';
import { Play } from './play/Play';
import { currentStreak, levelFromXp } from './engine/stats';

export default function App() {
  const ready = useStore((s) => s.ready);
  const init = useStore((s) => s.init);
  const uiLang = useStore((s) => s.settings.uiLang);
  const route = useRoute();
  const t = useT();

  useEffect(() => {
    init().catch((e) => console.error(e));
  }, [init]);

  useEffect(() => {
    document.documentElement.lang = uiLang;
  }, [uiLang]);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="text-center">
          <Logo />
          <div className="muted mt-4 text-sm">{t('loading')}</div>
        </div>
      </div>
    );
  }

  const [section, id, sub, levelIdx] = route;

  if (section === 'play') {
    return (
      <div className="min-h-dvh px-4 py-4 sm:px-6">
        <Play />
      </div>
    );
  }

  let screen;
  if (section === 'library') screen = <Library />;
  else if (section === 'settings') screen = <SettingsScreen />;
  else if (section === 'c' && id && sub === 'l' && levelIdx !== undefined) screen = <LevelView collectionId={id} index={Number(levelIdx)} />;
  else if (section === 'c' && id) screen = <CollectionView collectionId={id} />;
  else screen = <Dashboard />;

  return (
    <div className="min-h-dvh pb-24 sm:pb-10">
      <TopBar active={section ?? ''} />
      <main className="mx-auto max-w-5xl px-4 pt-5 sm:px-6">{screen}</main>
      <BottomNav active={section ?? ''} />
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-400 text-sm font-black text-[#06281c]">W</div>
      <span className="text-lg font-extrabold tracking-tight">
        Wort<span className="text-emerald-400">Sprint</span>
      </span>
    </div>
  );
}

const NAV = [
  { key: '', path: '/', label: 'navHome', icon: '⌂' },
  { key: 'library', path: '/library', label: 'navLibrary', icon: '▤' },
  { key: 'settings', path: '/settings', label: 'navSettings', icon: '⚙' },
] as const;

function TopBar({ active }: { active: string }) {
  const t = useT();
  const profile = useStore((s) => s.profile);
  const streak = currentStreak(profile.practiceDays, Date.now());
  const lvl = levelFromXp(profile.xp);
  const current = active === 'c' ? 'library' : active;
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[#0b0d12]/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:px-6">
        <button onClick={() => navigate('/')}>
          <Logo />
        </button>
        <nav className="ml-4 hidden gap-1 sm:flex">
          {NAV.map((n) => (
            <button key={n.key} onClick={() => navigate(n.path)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${current === n.key ? 'bg-white/5 text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>
              {t(n.label)}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-sm font-semibold">
          <span className="rounded-lg bg-amber-400/10 px-2.5 py-1 text-amber-300" title={t('streak')}>
            🔥 {streak}
          </span>
          <span className="rounded-lg bg-violet-400/10 px-2.5 py-1 text-violet-300" title={`${t('xp')} ${profile.xp}`}>
            ⭐ {t('playerLevel')} {lvl.level}
          </span>
        </div>
      </div>
    </header>
  );
}

function BottomNav({ active }: { active: string }) {
  const t = useT();
  const current = active === 'c' ? 'library' : active;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--line)] bg-[#0b0d12]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      {NAV.map((n) => (
        <button key={n.key} onClick={() => navigate(n.path)} className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${current === n.key ? 'text-emerald-400' : 'text-[var(--muted)]'}`}>
          <span className="text-lg leading-none">{n.icon}</span>
          {t(n.label)}
        </button>
      ))}
    </nav>
  );
}
