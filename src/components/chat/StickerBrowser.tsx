import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { fetchPublicPacks, setPackSaved } from '@/lib/stickers';
import type { StickerPack } from '@/lib/types';

interface StickerBrowserProps {
  profileId: string;
  savedPackIds: Set<string>;
  onBack: () => void;
  onChanged: () => void;
}

export default function StickerBrowser({ profileId, savedPackIds, onBack, onChanged }: StickerBrowserProps) {
  const [packs, setPacks] = useState<StickerPack[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchPublicPacks(profileId)
      .then((result) => {
        if (active) setPacks(result);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Не удалось загрузить наборы');
      });
    return () => {
      active = false;
    };
  }, [profileId]);

  const toggleSaved = async (pack: StickerPack) => {
    const saved = savedPackIds.has(pack.id);
    setPendingId(pack.id);
    setError(null);
    try {
      await setPackSaved(profileId, pack.id, !saved);
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось сохранить набор');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-2 py-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад"
          className="flex h-9 w-9 items-center justify-center rounded-full text-brand-600 transition hover:bg-brand-50 active:scale-90"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-[16px] font-bold text-slate-900">Общие наборы</h2>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2">
        {!packs && !error && (
          <div className="flex justify-center py-10 text-slate-500">
            <Loader2 className="animate-spin" size={22} />
          </div>
        )}
        {error && (
          <p role="alert" className="py-6 text-center text-[14px] text-red-600">
            {error}
          </p>
        )}
        {packs && packs.length === 0 && (
          <p className="py-10 text-center text-[14px] text-slate-500">Пока нет общих наборов от других пользователей.</p>
        )}

        {packs?.map((pack) => {
          const saved = savedPackIds.has(pack.id);
          return (
            <div key={pack.id} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                {pack.stickers.slice(0, 4).map((sticker) => (
                  <img key={sticker.id} src={sticker.image_url} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-contain" />
                ))}
              </div>
              <div className="min-w-0 max-w-[30%] shrink-0">
                <p className="truncate text-[14px] font-semibold text-slate-900">{pack.title}</p>
                <p className="text-[12px] text-slate-500">{pack.stickers.length} шт.</p>
              </div>
              <button
                type="button"
                disabled={pendingId === pack.id}
                onClick={() => void toggleSaved(pack)}
                className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-semibold transition active:scale-95 disabled:opacity-50 ${
                  saved ? 'bg-slate-100 text-slate-700' : 'bg-brand-500 text-white hover:bg-brand-600'
                }`}
              >
                {saved && <Check size={13} />}
                {saved ? 'Сохранено' : 'Сохранить'}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
