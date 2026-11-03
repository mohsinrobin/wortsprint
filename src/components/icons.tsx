// One icon system for the whole app (Phosphor), so nothing falls back to emoji.
import type { Icon } from '@phosphor-icons/react';
import {
  Barbell,
  Brain,
  CalendarCheck,
  Crown,
  Diamond,
  Eye,
  FlagCheckered,
  Flame,
  Keyboard,
  Lightning,
  MagnifyingGlass,
  MaskHappy,
  RocketLaunch,
  Shuffle,
  Star,
  Sword,
  Target,
  Trophy,
} from '@phosphor-icons/react';
import type { StageId } from '../types';

export const STAGE_ICON: Record<StageId, Icon> = {
  learn: Eye,
  recognize: MagnifyingGlass,
  reverse: Shuffle,
  recall: Keyboard,
  situations: MaskHappy,
  boss: Sword,
};

const BADGE_ICON: Record<string, Icon> = {
  'first-session': RocketLaunch,
  'first-level': FlagCheckered,
  'five-levels': Trophy,
  'streak-3': Flame,
  'streak-7': Flame,
  'streak-30': CalendarCheck,
  'mastered-25': Brain,
  'mastered-100': Diamond,
  perfect: Target,
  'combo-15': Lightning,
  'xp-1000': Star,
  'xp-10000': Crown,
};

export function BadgeIcon({ id, size = 18 }: { id: string; size?: number }) {
  const I = BADGE_ICON[id] ?? Barbell;
  return <I size={size} weight="bold" aria-hidden />;
}
