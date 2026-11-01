import { Bot, Check, MessageCircle, Trash2, UserPlus, X } from 'lucide-react';
import Avatar from '@/components/Avatar';
import ProfilePhotoHistory from '@/components/profile/ProfilePhotoHistory';
import StoriesSection from '@/components/profile/StoriesSection';
import type { Profile } from '@/lib/types';

interface ProfileSheetProps {
  profile: Profile;
  isContact?: boolean;
  busy?: boolean;
  onClose: () => void;
  onMessage?: () => void;
  onToggleContact?: () => void;
}

export default function ProfileSheet({
  profile,
  isContact = false,
  busy = false,
  onClose,
  onMessage,
  onToggleContact,
}: ProfileSheetProps) {
  return (
    <div className="absolute inset-0 z-30 flex items-end bg-slate-900/40 animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Профиль: ${profile.display_name}`}
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet-up max-h-[88%] w-full overflow-y-auto rounded-t-[28px] bg-white px-6 pb-10 pt-3 shadow-2xl"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition active:scale-90"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center">
          <Avatar name={profile.display_name} seed={profile.username} size={84} isBot={profile.is_bot} imageUrl={profile.avatar_url} />
          <p className="mt-4 flex items-center gap-1.5 text-[22px] font-bold leading-[1.2] text-slate-900">
            {profile.display_name}
            {profile.is_bot && <Bot size={18} className="text-brand-500" />}
          </p>
          <p className="mt-1 text-[15px] text-slate-500">@{profile.username}</p>
          {profile.bio && <p className="mt-3 max-w-xs text-[14px] leading-[1.5] text-slate-600">{profile.bio}</p>}
        </div>

        {!profile.is_bot && (
          <div className="mt-6 flex flex-col gap-6 border-t border-slate-100 pt-5">
            <StoriesSection profileId={profile.id} isOwner={false} />
            <ProfilePhotoHistory profileId={profile.id} />
          </div>
        )}

        {onMessage && onToggleContact && (
          <div className="mt-7 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onMessage}
              disabled={busy}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 text-[16px] font-semibold text-white shadow-md shadow-brand-500/25 transition hover:bg-brand-600 active:scale-[0.98] disabled:opacity-60"
            >
              <MessageCircle size={18} /> Написать
            </button>
            <button
              type="button"
              onClick={onToggleContact}
              disabled={busy}
              className={`flex h-12 items-center justify-center gap-2 rounded-xl text-[16px] font-semibold transition active:scale-[0.98] disabled:opacity-60 ${
                isContact ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
              }`}
            >
              {isContact ? (
                <>
                  <Trash2 size={18} /> Удалить из контактов
                </>
              ) : (
                <>
                  <UserPlus size={18} /> Добавить в контакты
                </>
              )}
            </button>
            {isContact && (
              <p className="flex items-center justify-center gap-1 text-[13px] text-emerald-600">
                <Check size={14} /> Есть в ваших контактах
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
