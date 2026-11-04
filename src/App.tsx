import { useEffect } from 'react';
import { domAnimation, LazyMotion, MotionConfig } from 'motion/react';
import { BookOpenText, Flame, GearSix, House, Moon, Sun } from '@phosphor-icons/react';
import { setThemePref, useTheme } from './lib/theme';
import { useLook } from './lib/look';
import { useStore } from './store/useStore';
import { navigate, useRoute } from './lib/router';
import { useT } from './lib/i18n';
import { Dashboard } from './screens/Dashboard';
import { Library } from './screens/Library';
import { CollectionView } from './screens/CollectionView';
import { LevelView } from './screens/LevelView';
import { MutprobeDetail, MutprobeList } from './screens/Mutprobe';
import { SettingsScreen } from './screens/Settings';
import { PrivacyPage } from './screens/Legal';
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
      <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div className="min-h-dvh px-4 py-4 sm:px-6">
          <Play />
        </div>
      </MotionConfig>
      </LazyMotion>
    );
  }

  let screen;
  if (section === 'library') screen = <Library />;
  else if (section === 'settings') screen = <SettingsScreen />;
  else if (section === 'privacy') screen = <PrivacyPage />;
  else if (section === 'mutprobe' && id !== undefined) screen = <MutprobeDetail index={Number(id)} />;
  else if (section === 'mutprobe') screen = <MutprobeList />;
  else if (section === 'c' && id && sub === 'l' && levelIdx !== undefined) screen = <LevelView collectionId={id} index={Number(levelIdx)} />;
  else if (section === 'c' && id) screen = <CollectionView collectionId={id} />;
  else screen = <Dashboard />;

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
      <div className="min-h-dvh pb-24 sm:pb-12">
        <TopBar active={section ?? ''} />
        <main key={route.join('/')} className="mx-auto max-w-5xl animate-pop px-4 pt-6 sm:px-6 sm:pt-8">
          {screen}
        </main>
        <BottomNav active={section ?? ''} />
      </div>
    </MotionConfig>
      </LazyMotion>
  );
}

function Logo() {
  const look = useLook();
  if (look === 'bahn')
    return <span className="rounded-[4px] bg-board px-2 py-0.5 text-[19px] font-semibold tracking-tight text-boardink">WortSprint</span>;
  return (
    <span className="flex items-baseline text-xl font-bold tracking-tight text-ink">
      Wort<span className="hand -ml-px -rotate-2 text-[23px] font-bold text-blue">sprint</span>
    </span>
  );
}

/** The nav tab a route belongs to: sub-pages light up their parent tab. */
function navKey(section: string) {
  if (section === 'c' || section === 'mutprobe') return 'library';
  if (section === 'privacy') return 'settings';
  return section;
}

const NAV = [
  { key: '', path: '/', label: 'navHome', Icon: House },
  { key: 'library', path: '/library', label: 'navLibrary', Icon: BookOpenText },
  { key: 'settings', path: '/settings', label: 'navSettings', Icon: GearSix },
] as const;

function TopBar({ active }: { active: string }) {
  const t = useT();
  const profile = useStore((s) => s.profile);
  const streak = currentStreak(profile.practiceDays, Date.now());
  const lvl = levelFromXp(profile.xp);
  const current = navKey(active);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:px-6">
        <button onClick={() => navigate('/')} aria-label={t('navHome')}>
          <Logo />
        </button>
        <nav className="ml-6 hidden gap-1 sm:flex">
          {NAV.map((n) => (
            <button key={n.key} onClick={() => navigate(n.path)} className={`relative px-3 py-1.5 text-[15px] font-semibold transition-colors ${current === n.key ? 'text-ink' : 'text-pencil hover:text-ink'}`}>
              {t(n.label)}
              {current === n.key && <span className="absolute inset-x-3 -bottom-[11px] h-[3px] rounded-full bg-blue" />}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-[15px] font-semibold">
          <ThemeButton />
          <span className={`flex items-center gap-1 ${streak > 0 ? 'text-pen' : 'text-pencil'}`} title={t('streak')}>
            <Flame size={18} weight={streak > 0 ? 'fill' : 'regular'} aria-hidden />
            {streak}
          </span>
          <span className="flex items-baseline gap-1 text-ink" title={`${t('xp')} ${profile.xp}`}>
            <span className="text-pencil">{t('playerLevel')}</span>
            <span className="hand text-xl font-bold text-blue">{lvl.level}</span>
          </span>
        </div>
      </div>
    </header>
  );
}

function ThemeButton() {
  const t = useT();
  const { theme } = useTheme();
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <button onClick={() => setThemePref(theme === 'dark' ? 'light' : 'dark')} className="grid h-9 w-9 place-items-center rounded-full text-pencil transition-colors hover:bg-ink/5 hover:text-ink" aria-label={t('themeToggle')} title={t('themeToggle')}>
      <Icon size={19} weight="bold" />
    </button>
  );
}

function BottomNav({ active }: { active: string }) {
  const t = useT();
  const current = navKey(active);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:hidden">
      {NAV.map(({ key, path, label, Icon }) => (
        <button key={key} onClick={() => navigate(path)} className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-semibold ${current === key ? 'text-blue' : 'text-pencil'}`}>
          <Icon size={22} weight={current === key ? 'fill' : 'regular'} aria-hidden />
          {t(label)}
        </button>
      ))}
    </nav>
  );
}
