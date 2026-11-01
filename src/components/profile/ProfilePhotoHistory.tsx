import { useEffect, useState } from 'react';
import { formatDayLabel } from '@/lib/format';
import { fetchProfilePhotos } from '@/lib/profiles';
import PhotoViewer from '@/components/profile/PhotoViewer';
import type { ProfilePhoto } from '@/lib/types';

export default function ProfilePhotoHistory({ profileId }: { profileId: string }) {
  const [photos, setPhotos] = useState<ProfilePhoto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetchProfilePhotos(profileId)
      .then((list) => {
        if (active) setPhotos(list);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [profileId]);

  if (failed) {
    return <p className="text-center text-[13px] text-slate-500">Не удалось загрузить историю фото</p>;
  }
  if (photos === null) return null;
  if (photos.length === 0) {
    return <p className="text-center text-[13px] text-slate-500">История фото пока пуста</p>;
  }

  return (
    <div className="w-full">
      <p className="mb-2 text-center text-[13px] font-semibold text-slate-500">История фото · {photos.length}</p>
      <div className="no-scrollbar flex justify-center gap-2 overflow-x-auto py-1">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpenIndex(index)}
            aria-label={`Открыть фото от ${formatDayLabel(photo.created_at)}`}
            className="h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-200 transition hover:ring-brand-400 active:scale-95"
          >
            <img src={photo.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {openIndex !== null && (
        <PhotoViewer photos={photos} index={openIndex} onIndexChange={setOpenIndex} onClose={() => setOpenIndex(null)} />
      )}
    </div>
  );
}
