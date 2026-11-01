import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Clapperboard, ImagePlus, Loader2, Music2, Video, X } from 'lucide-react';
import { publishStory } from '@/lib/stories';

const CAPTION_LIMIT = 300;
interface StoryComposerProps { profileId: string; onClose: () => void; onPublished: () => void }

export default function StoryComposer({ profileId, onClose, onPublished }: StoryComposerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const isVideo = Boolean(file?.type.startsWith('video/'));

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const chooseFile = (picked?: File) => {
    if (!picked) return;
    if (!picked.type.startsWith('image/') && !picked.type.startsWith('video/')) {
      setError('Выбери фото или видео.'); return;
    }
    setError(null); setFile(picked);
  };

  const handlePublish = async () => {
    if (!file || busy) return;
    setBusy(true); setError(null);
    try { await publishStory(profileId, file, caption, audioFile); onPublished(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Не удалось опубликовать историю'); setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Новая история" onClick={(e) => e.stopPropagation()}
        className="animate-sheet-up flex max-h-[94%] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-[30px] border border-white/60 bg-white px-5 pb-8 pt-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
        <div className="flex items-center justify-between">
          <div><h2 className="text-[19px] font-bold text-slate-900 dark:text-white">Новая история</h2><p className="mt-0.5 text-xs text-slate-500">Поделись моментом с друзьями</p></div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 active:scale-90 dark:bg-slate-800 dark:text-slate-300"><X size={18} /></button>
        </div>
        <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-[24px] bg-slate-950 shadow-inner">
          {previewUrl ? (isVideo ? <video src={previewUrl} controls playsInline className="h-full w-full object-contain" /> : <img src={previewUrl} alt="Предпросмотр истории" className="h-full w-full object-contain" />) : (
            <div className="flex flex-col items-center gap-3 px-8 text-center text-white/70"><div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10"><Clapperboard size={30} /></div><p className="text-sm">Выбери фото или видео<br/>для своей истории</p></div>
          )}
          {file && <button type="button" onClick={() => setFile(null)} className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">Изменить</button>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className="flex flex-col items-center gap-1.5 rounded-2xl bg-brand-500/10 px-2 py-3 text-xs font-semibold text-brand-600 transition hover:bg-brand-500/15 dark:text-brand-300"><ImagePlus size={21}/>Галерея</button>
          <button type="button" onClick={() => cameraInput.current?.click()} disabled={busy} className="flex flex-col items-center gap-1.5 rounded-2xl bg-slate-100 px-2 py-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"><Camera size={21}/>Сфоткать</button>
          <button type="button" onClick={() => videoInput.current?.click()} disabled={busy} className="flex flex-col items-center gap-1.5 rounded-2xl bg-slate-100 px-2 py-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"><Video size={21}/>Записать</button>
        </div>
        <input ref={fileInput} type="file" accept="image/*,video/*" className="hidden" onChange={e => { chooseFile(e.target.files?.[0]); e.target.value = ''; }}/>
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { chooseFile(e.target.files?.[0]); e.target.value = ''; }}/>
        <input ref={videoInput} type="file" accept="video/*" capture="environment" className="hidden" onChange={e => { chooseFile(e.target.files?.[0]); e.target.value = ''; }}/>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-800"><div className="flex min-w-0 items-center gap-2 text-sm text-slate-600 dark:text-slate-200"><Music2 size={18} className="shrink-0 text-brand-500"/><span className="truncate">{audioFile ? audioFile.name : 'Музыка к истории'}</span></div><label className="shrink-0 cursor-pointer rounded-xl bg-white px-3 py-2 text-xs font-semibold text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300">{audioFile ? 'Заменить' : 'Добавить'}<input type="file" accept="audio/*" className="hidden" onChange={e => setAudioFile(e.target.files?.[0] ?? null)}/></label></div>
        <label className="flex flex-col gap-1.5"><span className="flex justify-between text-[13px] font-semibold text-slate-500"><span>Подпись</span><span>{caption.length}/{CAPTION_LIMIT}</span></span><textarea value={caption} onChange={e => setCaption(e.target.value.slice(0, CAPTION_LIMIT))} rows={2} placeholder="Добавь что-нибудь..." className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800"/></label>
        <p className="text-[11px] leading-relaxed text-slate-400">Фото, видео и аудио до 50 МБ. Музыку можно выбрать из файлов устройства. Доступность камеры зависит от браузера и разрешений устройства.</p>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        <button type="button" onClick={() => void handlePublish()} disabled={!file || busy} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand-500 text-[15px] font-bold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none">{busy && <Loader2 size={18} className="animate-spin"/>}Опубликовать историю</button>
      </div>
    </div>, document.body
  );
}
