// The Mutprobe entry in the Library, drawn in each theme's own world.
import { ArrowRight, Lightning } from '@phosphor-icons/react';
import { useT } from '../lib/i18n';
import { useLook } from '../lib/look';
import { ProgressBar } from '../components/ui';

export function ChallengeCard({ passed, total, onOpen }: { passed: number; total: number; onOpen: () => void }) {
  const look = useLook();
  const t = useT();

  if (look === 'bahn') {
    // An express train on the departure board: red line badge, signal yellow.
    return (
      <button onClick={onOpen} className="flex w-full items-center gap-4 rounded-sheet bg-board p-4 text-left text-boardink shadow-lift transition-transform active:scale-[0.99]">
        <span className="grid h-12 w-14 shrink-0 place-items-center rounded-[6px] bg-pen text-sheet">
          <Lightning size={26} weight="fill" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[20px] font-semibold leading-tight">
            Mutprobe <span className="font-normal text-boardink/75">· {t('challenge')}</span>
          </span>
          <span className="block text-sm text-boardink/75">{t('mutprobeTagline')}</span>
          <span className="mt-2 flex items-center gap-3 text-sm">
            <span className="shrink-0 font-semibold text-signal">{t('mutprobeProgress', { n: passed })}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-boardink/20">
              <span className="block h-full rounded-full bg-signal" style={{ width: `${(passed / total) * 100}%` }} />
            </span>
          </span>
        </span>
      </button>
    );
  }

  // Schulheft: an exam sheet with a red-ink header, the teacher's pen.
  return (
    <button onClick={onOpen} className="card group w-full overflow-hidden text-left transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lift">
      <span className="flex items-end justify-between gap-3 border-b-2 border-double border-pen/60 px-5 pb-2 pt-4">
        <span className="flex items-baseline gap-2">
          <span className="hand text-[32px] font-bold leading-none text-pen">Mutprobe</span>
          <span className="text-[15px] font-semibold text-pen/80">{t('challenge')}</span>
        </span>
        <span className="pb-0.5 text-sm font-semibold text-pencil">{t('mutprobeMeta')}</span>
      </span>
      <span className="block px-5 pb-4 pt-3">
        <span className="flex items-center justify-between gap-3">
          <span className="text-[15px]">{t('mutprobeTagline')}</span>
          <ArrowRight size={18} weight="bold" className="shrink-0 text-pen transition-transform group-hover:translate-x-0.5" />
        </span>
        <span className="mt-3 block text-sm font-semibold text-pencil">{t('mutprobeProgress', { n: passed })}</span>
        <ProgressBar value={passed / total} color="bg-pen" className="mt-1.5" />
      </span>
    </button>
  );
}
