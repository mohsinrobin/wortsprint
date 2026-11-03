import { CollectionCard } from '../looks/CollectionCard';
import { useStore } from '../store/useStore';
import { navigate } from '../lib/router';
import { useT } from '../lib/i18n';
import { PageHeader } from '../components/ui';
import { buildLevels } from '../engine/levels';
import { memoryState } from '../engine/srs';

export function Library() {
  const t = useT();
  const collections = useStore((s) => s.collections);
  const words = useStore((s) => s.words);
  const progress = useStore((s) => s.progress);

  return (
    <div className="space-y-8">
      <PageHeader title={t('library')} />
      <section className="grid gap-4 sm:grid-cols-2">
        {collections.map((c, i) => {
          const list = words[c.id] ?? [];
          return (
            <CollectionCard
              key={c.id}
              c={c}
              index={i}
              words={list.length}
              levels={buildLevels(c.id, list).length}
              learned={list.filter((w) => progress[w.id]?.encounters).length}
              mastered={list.filter((w) => memoryState(progress[w.id]) === 'mastered').length}
              onOpen={() => navigate(`/c/${encodeURIComponent(c.id)}`)}
            />
          );
        })}
      </section>
    </div>
  );
}
