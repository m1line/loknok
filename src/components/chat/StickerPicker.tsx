import { useState, type ReactNode } from 'react';
import { Globe, Loader2, Plus, Star, X } from 'lucide-react';
import StickerBrowser from '@/components/chat/StickerBrowser';
import StickerPackEditor from '@/components/chat/StickerPackEditor';
import { useStickerCollection } from '@/hooks/useStickerCollection';
import { setPackPublic, setPackSaved, setStickerFavorite } from '@/lib/stickers';
import type { Sticker, StickerPack } from '@/lib/types';

interface StickerPickerProps {
  profileId: string;
  onPick: (stickerUrl: string) => void;
  onClose: () => void;
}

type PickerView = { kind: 'collection' } | { kind: 'browse' };
type EditorState = { kind: 'closed' } | { kind: 'create' } | { kind: 'add'; pack: StickerPack };

export default function StickerPicker({ profileId, onPick, onClose }: StickerPickerProps) {
  const { collection, status, reload } = useStickerCollection(profileId);
  const [view, setView] = useState<PickerView>({ kind: 'collection' });
  const [editor, setEditor] = useState<EditorState>({ kind: 'closed' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const favoriteIds = new Set(collection?.favorites.map((sticker) => sticker.id));

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось выполнить действие');
    } finally {
      setBusy(false);
    }
  };

  const toggleFavorite = (sticker: Sticker) =>
    runAction(() => setStickerFavorite(profileId, sticker.id, !favoriteIds.has(sticker.id)));

  if (view.kind === 'browse') {
    return (
      <Panel>
        <StickerBrowser
          profileId={profileId}
          savedPackIds={new Set(collection?.packs.filter((p) => p.owner_id !== profileId).map((p) => p.id))}
          onBack={() => setView({ kind: 'collection' })}
          onChanged={() => void reload()}
        />
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
        <h2 className="text-[16px] font-bold text-slate-900">Стикеры</h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setView({ kind: 'browse' })}
            className="flex h-8 items-center gap-1 rounded-full bg-slate-100 px-3 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-95"
          >
            <Globe size={14} />
            Найти наборы
          </button>
          <button
            type="button"
            onClick={() => setEditor({ kind: 'create' })}
            className="flex h-8 items-center gap-1 rounded-full bg-brand-500 px-3 text-[13px] font-semibold text-white transition hover:bg-brand-600 active:scale-95"
          >
            <Plus size={14} />
            Создать
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть стикеры"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 active:scale-90"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2">
        {status === 'loading' && (
          <div className="flex h-full items-center justify-center py-10 text-slate-500">
            <Loader2 className="animate-spin" size={22} />
          </div>
        )}
        {status === 'error' && <p className="py-8 text-center text-[14px] text-red-600">Не удалось загрузить стикеры.</p>}
        {error && (
          <p role="alert" className="px-1 pb-2 text-[13px] text-red-600">
            {error}
          </p>
        )}

        {status === 'ready' && collection && (
          <>
            <PackSection title="Избранные">
              {collection.favorites.length === 0 ? (
                <p className="px-1 py-3 text-[13px] text-slate-500">Нажмите звездочку на стикере, чтобы сохранить его сюда.</p>
              ) : (
                <StickerGrid
                  stickers={collection.favorites}
                  favoriteIds={favoriteIds}
                  disabled={busy}
                  onPick={onPick}
                  onToggleFavorite={toggleFavorite}
                />
              )}
            </PackSection>

            {collection.packs.length === 0 && (
              <p className="px-1 pt-3 text-[13px] text-slate-500">
                Наборов пока нет. Создайте свой набор или сохраните общий набор.
              </p>
            )}

            {collection.packs.map((pack) => {
              const isOwner = pack.owner_id === profileId;
              return (
                <PackSection
                  key={pack.id}
                  title={pack.title}
                  badge={isOwner ? (pack.is_public ? 'Общий' : 'Мой набор') : 'Сохранено'}
                  actions={
                    isOwner ? (
                      <>
                        <PackAction
                          label="Добавить"
                          icon={<Plus size={13} />}
                          disabled={busy}
                          onClick={() => setEditor({ kind: 'add', pack })}
                        />
                        <PackAction
                          label={pack.is_public ? 'Закрыть' : 'Открыть всем'}
                          disabled={busy}
                          onClick={() => runAction(() => setPackPublic(pack.id, !pack.is_public))}
                        />
                      </>
                    ) : (
                      <PackAction
                        label="Убрать"
                        icon={<X size={13} />}
                        disabled={busy}
                        onClick={() => runAction(() => setPackSaved(profileId, pack.id, false))}
                      />
                    )
                  }
                >
                  <StickerGrid
                    stickers={pack.stickers}
                    favoriteIds={favoriteIds}
                    disabled={busy}
                    onPick={onPick}
                    onToggleFavorite={toggleFavorite}
                  />
                </PackSection>
              );
            })}
          </>
        )}
      </div>

      {editor.kind !== 'closed' && (
        <StickerPackEditor
          profileId={profileId}
          pack={editor.kind === 'add' ? editor.pack : null}
          onClose={() => setEditor({ kind: 'closed' })}
          onSaved={() => {
            setEditor({ kind: 'closed' });
            void reload();
          }}
        />
      )}
    </Panel>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-x-0 bottom-full z-30 flex h-[380px] flex-col overflow-hidden rounded-t-3xl border-t border-slate-200 bg-white shadow-2xl animate-sheet-up">
      {children}
    </div>
  );
}

function PackSection({
  title,
  badge,
  actions,
  children,
}: {
  title: string;
  badge?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="pt-3">
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-[14px] font-semibold text-slate-800">{title}</h3>
          {badge && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{badge}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      </div>
      {children}
    </section>
  );
}

function PackAction({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon?: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold text-brand-600 transition hover:bg-brand-50 active:scale-95 disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}

function StickerGrid({
  stickers,
  favoriteIds,
  disabled,
  onPick,
  onToggleFavorite,
}: {
  stickers: Sticker[];
  favoriteIds: Set<string>;
  disabled: boolean;
  onPick: (stickerUrl: string) => void;
  onToggleFavorite: (sticker: Sticker) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {stickers.map((sticker) => {
        const isFavorite = favoriteIds.has(sticker.id);
        return (
          <div key={sticker.id} className="relative">
            <button
              type="button"
              onClick={() => onPick(sticker.image_url)}
              aria-label="Отправить стикер"
              className="flex aspect-square w-full items-center justify-center rounded-xl p-1 transition hover:bg-slate-100 active:scale-90"
            >
              <img src={sticker.image_url} alt="" loading="lazy" className="h-full w-full object-contain" />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onToggleFavorite(sticker)}
              aria-label={isFavorite ? 'Убрать из избранного' : 'В избранное'}
              className={`absolute right-0 top-0 flex h-6 w-6 items-center justify-center rounded-full shadow-sm transition active:scale-90 disabled:opacity-50 ${
                isFavorite ? 'bg-amber-400 text-white' : 'bg-white/90 text-slate-500'
              }`}
            >
              {isFavorite ? <Star size={12} fill="currentColor" /> : <Star size={12} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
