import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import { formatDayLabel } from '@/lib/format';
import type { Story } from '@/lib/types';

interface StoryViewerProps {
  stories: Story[];
  index: number;
  archived: boolean;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onDelete?: (story: Story) => Promise<void>;
}

function timeLabel(story: Story, archived: boolean): string {
  if (archived) return formatDayLabel(story.created_at);
  const hoursLeft = Math.ceil((new Date(story.expires_at).getTime() - Date.now()) / 3_600_000);
  return `Осталось ${Math.max(hoursLeft, 1)} ч`;
}

export default function StoryViewer({ stories, index, archived, onIndexChange, onClose, onDelete }: StoryViewerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const story = stories[index];
  const hasPrev = index > 0;
  const hasNext = index < stories.length - 1;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && hasPrev) onIndexChange(index - 1);
      if (event.key === 'ArrowRight' && hasNext) onIndexChange(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, hasPrev, hasNext, onIndexChange, onClose]);

  if (!story) return null;

  const handleDelete = async () => {
    if (!onDelete || busy) return;
    if (!window.confirm('Удалить историю безвозвратно?')) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(story);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось удалить историю');
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white animate-fade-in" role="dialog" aria-modal="true">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-4">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{timeLabel(story, archived)}</p>
          <p className="text-[12px] text-white/60">
            {index + 1} из {stories.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={busy}
              aria-label="Удалить историю"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-90 disabled:opacity-50"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-90"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-12">
        {/\.(mp4|webm|mov)(?:\?|$)/i.test(story.image_url) ? (
          <video src={story.image_url} controls autoPlay playsInline className="max-h-full max-w-full rounded-2xl object-contain" />
        ) : (
          <img src={story.image_url} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
        )}
        {hasPrev && (
          <button
            type="button"
            onClick={() => onIndexChange(index - 1)}
            aria-label="Предыдущая история"
            className="absolute left-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-90"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={() => onIndexChange(index + 1)}
            aria-label="Следующая история"
            className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-90"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      <div className="shrink-0 px-6 pb-8 pt-4">
        {story.audio_url && <audio src={story.audio_url} controls className="mx-auto mb-3 h-10 max-w-full" />}
        {story.caption && <p className="text-center text-[15px] leading-[1.5] text-white/90">{story.caption}</p>}
        {error && <p role="alert" className="mt-2 text-center text-[13px] text-red-300">{error}</p>}
      </div>
    </div>,
    document.body
  );
}
