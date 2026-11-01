import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import {
  addStickersToPack,
  createStickerPack,
  MAX_PACK_TITLE_LENGTH,
  MAX_STICKERS_PER_UPLOAD,
} from '@/lib/stickers';
import type { StickerPack } from '@/lib/types';

interface StickerPackEditorProps {
  profileId: string;
  pack: StickerPack | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function StickerPackEditor({ profileId, pack, onClose, onSaved }: StickerPackEditorProps) {
  const isAdding = pack !== null;
  const [title, setTitle] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const trimmedTitle = title.trim();
  const canSave = files.length > 0 && (isAdding || trimmedTitle.length > 0) && !saving;

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list).slice(0, MAX_STICKERS_PER_UPLOAD);
    setFiles(picked);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setError(null);
    try {
      if (pack) {
        await addStickersToPack(profileId, pack.id, files);
      } else {
        await createStickerPack(profileId, trimmedTitle, isPublic, files);
      }
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось сохранить стикеры');
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-end bg-slate-900/40 animate-fade-in" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit} className="flex max-h-full w-full flex-col gap-4 overflow-y-auto rounded-t-3xl bg-white px-5 pb-6 pt-4 shadow-2xl animate-sheet-up">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-slate-900">{isAdding ? 'Добавить стикеры' : 'Новый набор'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 active:scale-90"
          >
            <X size={20} />
          </button>
        </div>

        {!isAdding && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-slate-600">Название набора</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={MAX_PACK_TITLE_LENGTH}
                placeholder="Например, Котики"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
              />
            </label>
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
              <span>
                <span className="block text-[15px] text-slate-900">Общий набор</span>
                <span className="mt-0.5 block text-[13px] leading-[1.4] text-slate-500">
                  Стикеры видны всем, и другие пользователи смогут сохранить набор к себе.
                </span>
              </span>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-brand-500"
              />
            </label>
          </>
        )}

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/50 px-4 py-6 text-center transition hover:bg-brand-50">
          <ImagePlus size={28} className="text-brand-500" />
          <span className="text-[15px] font-semibold text-brand-700">Выбрать изображения</span>
          <span className="text-[13px] text-slate-500">PNG, JPG или WebP, до {MAX_STICKERS_PER_UPLOAD} штук</span>
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>

        {previews.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {previews.map((url) => (
              <img key={url} src={url} alt="" className="aspect-square w-full rounded-xl bg-slate-50 object-contain p-1" />
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="text-[13px] text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSave}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 text-[16px] font-semibold text-white shadow-md shadow-brand-500/30 transition hover:bg-brand-600 active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none"
        >
          {saving && <Loader2 size={18} className="animate-spin" />}
          {saving ? 'Загружаем...' : isAdding ? 'Добавить' : 'Создать набор'}
        </button>
      </form>
    </div>
  );
}
