import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatClock, formatDayLabel } from '@/lib/format';
import type { ProfilePhoto } from '@/lib/types';

interface PhotoViewerProps {
  photos: ProfilePhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export default function PhotoViewer({ photos, index, onIndexChange, onClose }: PhotoViewerProps) {
  const photo = photos[index];
  const lastIndex = photos.length - 1;

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1);
      if (event.key === 'ArrowRight' && index < lastIndex) onIndexChange(index + 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, lastIndex, onClose, onIndexChange]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Фото профиля"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex animate-fade-in flex-col bg-slate-950/95"
    >
      <div className="flex items-center justify-between px-5 pb-3 pt-4 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="text-[16px] font-semibold">{formatDayLabel(photo.created_at)}</p>
          <p className="text-[13px] text-white/70">
            {formatClock(photo.created_at)} · {index + 1} из {photos.length}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть фото"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-90"
        >
          <X size={20} />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-12" onClick={(e) => e.stopPropagation()}>
        <img
          key={photo.id}
          src={photo.image_url}
          alt="Фото профиля"
          className="max-h-full max-w-full animate-rise-in rounded-2xl object-contain"
        />
        {index > 0 && (
          <button
            type="button"
            onClick={() => onIndexChange(index - 1)}
            aria-label="Более новое фото"
            className="absolute left-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-90"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        {index < lastIndex && (
          <button
            type="button"
            onClick={() => onIndexChange(index + 1)}
            aria-label="Более старое фото"
            className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-90"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
