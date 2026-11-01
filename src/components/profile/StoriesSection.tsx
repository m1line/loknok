import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import StoryComposer from '@/components/profile/StoryComposer';
import StoryViewer from '@/components/profile/StoryViewer';
import { deleteStory, fetchActiveStories, fetchArchivedStories } from '@/lib/stories';
import type { Story } from '@/lib/types';

type ViewerState = { list: 'active' | 'archive'; index: number };

interface StoriesSectionProps {
  profileId: string;
  isOwner: boolean;
}

export default function StoriesSection({ profileId, isOwner }: StoriesSectionProps) {
  const [active, setActive] = useState<Story[] | null>(null);
  const [archived, setArchived] = useState<Story[] | null>(null);
  const [failed, setFailed] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchActiveStories(profileId),
      isOwner ? fetchArchivedStories(profileId) : Promise.resolve<Story[]>([]),
    ])
      .then(([activeList, archivedList]) => {
        if (!alive) return;
        setActive(activeList);
        setArchived(archivedList);
        setFailed('');
      })
      .catch((caught: unknown) => {
        if (alive) setFailed(caught instanceof Error ? caught.message : 'Не удалось загрузить истории. Проверьте SUPABASE_SETUP.sql.');
      });
    return () => {
      alive = false;
    };
  }, [profileId, isOwner, reloadKey]);

  const reload = () => setReloadKey((key) => key + 1);

  const handleDelete = async (story: Story) => {
    await deleteStory(story);
    setViewer(null);
    reload();
  };

  if (failed) {
    return <div className="rounded-xl bg-amber-50 p-3 text-center text-[12px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><p>{failed}</p><button type="button" onClick={reload} className="mt-2 font-semibold underline">Повторить</button></div>;
  }
  if (active === null || archived === null) return null;

  const viewerStories = viewer?.list === 'archive' ? archived : active;

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-slate-500">
          Истории{active.length > 0 && ` · ${active.length}`}
        </p>
        {isOwner && (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded-full bg-brand-500 px-3 text-[13px] font-semibold text-white shadow-sm shadow-brand-500/25 transition hover:bg-brand-600 active:scale-95"
          >
            <Plus size={14} /> Опубликовать
          </button>
        )}
      </div>

      {active.length === 0 ? (
        <p className="text-center text-[13px] text-slate-500">
          {isOwner ? 'Активных историй нет. Опубликуйте первую.' : 'Нет активных историй'}
        </p>
      ) : (
        <div className="no-scrollbar flex gap-3 overflow-x-auto py-1">
          {active.map((story, index) => (
            <button
              key={story.id}
              type="button"
              onClick={() => setViewer({ list: 'active', index })}
              aria-label="Открыть историю"
              className="shrink-0 rounded-full bg-gradient-to-tr from-brand-500 to-sky-300 p-[3px] transition active:scale-95"
            >
              {/\.(mp4|webm|mov)(?:\?|$)/i.test(story.image_url) ? (
                <video src={story.image_url} muted playsInline className="h-14 w-14 rounded-full object-cover ring-2 ring-white" />
              ) : (
                <img src={story.image_url} alt="" loading="lazy" className="h-14 w-14 rounded-full object-cover ring-2 ring-white" />
              )}
            </button>
          ))}
        </div>
      )}

      {isOwner && (
        <div className="mt-5">
          <p className="mb-2 text-[13px] font-semibold text-slate-500">
            Архив{archived.length > 0 && ` · ${archived.length}`}
          </p>
          {archived.length === 0 ? (
            <p className="text-center text-[13px] text-slate-500">Архив пуст. Истории попадают сюда через 48 часов.</p>
          ) : (
            <div className="no-scrollbar flex gap-2 overflow-x-auto py-1">
              {archived.map((story, index) => (
                <button
                  key={story.id}
                  type="button"
                  onClick={() => setViewer({ list: 'archive', index })}
                  aria-label="Открыть историю из архива"
                  className="h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-200 transition hover:ring-brand-400 active:scale-95"
                >
                  {/\.(mp4|webm|mov)(?:\?|$)/i.test(story.image_url) ? (
                  <video src={story.image_url} muted playsInline className="h-full w-full object-cover" />
                ) : (
                  <img src={story.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {viewer && viewerStories && (
        <StoryViewer
          stories={viewerStories}
          index={viewer.index}
          archived={viewer.list === 'archive'}
          onIndexChange={(index) => setViewer({ ...viewer, index })}
          onClose={() => setViewer(null)}
          onDelete={isOwner ? handleDelete : undefined}
        />
      )}
      {composerOpen && (
        <StoryComposer
          profileId={profileId}
          onClose={() => setComposerOpen(false)}
          onPublished={() => {
            setComposerOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
