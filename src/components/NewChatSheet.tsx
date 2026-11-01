import { useEffect, useState, type ReactNode } from 'react';
import { Bot, Loader2, Search, Users, X } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { useContacts } from '@/hooks/useContacts';
import { fetchBots, openDirectChat, searchProfiles } from '@/lib/profiles';
import type { Profile } from '@/lib/types';

interface NewChatSheetProps {
  myProfileId: string;
  onOpenChat: (chatId: string, peer: Profile) => void;
  onClose: () => void;
}

export default function NewChatSheet({ myProfileId, onOpenChat, onClose }: NewChatSheetProps) {
  const { contacts, status } = useContacts(myProfileId);
  const [bots, setBots] = useState<Profile[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedQuery = query.trim();
  const contactIds = new Set(contacts.map((c) => c.id));
  const bareBots = bots.filter((bot) => !contactIds.has(bot.id));

  useEffect(() => {
    let active = true;
    fetchBots()
      .then((list) => {
        if (active) setBots(list);
      })
      .catch(() => {
        if (active) setError('Не удалось загрузить ботов');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!trimmedQuery) {
      setResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchProfiles(trimmedQuery, myProfileId)
        .then((list) => {
          if (active) setResults(list);
        })
        .catch((err: Error) => {
          if (active) setError(err.message);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [trimmedQuery, myProfileId]);

  const handleOpen = async (profile: Profile) => {
    setOpening(true);
    setError(null);
    try {
      const chatId = await openDirectChat(profile.id);
      onOpenChat(chatId, profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось открыть чат');
      setOpening(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 animate-fade-in sm:items-center sm:p-6">
      <button type="button" aria-label="Закрыть" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Новый чат"
        className="relative flex h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-sheet-up sm:h-[70dvh] sm:rounded-3xl"
      >
        <header className="border-b border-slate-200/70 px-5 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-bold leading-[1.2] text-slate-900">Новый чат</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 active:scale-90"
            >
              <X size={18} />
            </button>
          </div>
          <label className="mt-3 flex h-10 items-center gap-2 rounded-xl bg-slate-100 px-3 transition focus-within:bg-slate-200/70 focus-within:ring-4 focus-within:ring-brand-500/10">
            <Search size={18} className="shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по @username"
              aria-label="Поиск людей и ботов"
              className="w-full bg-transparent text-[16px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </label>
        </header>

        {error && (
          <p role="alert" className="mx-5 mt-3 rounded-xl bg-red-50 px-4 py-2 text-[14px] text-red-600 animate-shake">
            {error}
          </p>
        )}

        <div className="no-scrollbar flex-1 overflow-y-auto pb-6">
          {trimmedQuery ? (
            <Section title="Результаты поиска">
              {searching && results.length === 0 && <EmptyNote>Ищем...</EmptyNote>}
              {!searching && results.length === 0 && <EmptyNote>Никого не нашли по этому имени.</EmptyNote>}
              {results.map((profile) => (
                <PeerRow key={profile.id} profile={profile} disabled={opening} onOpen={handleOpen} />
              ))}
            </Section>
          ) : (
            <>
              <Section title="Контакты">
                {status === 'loading' && <EmptyNote>Загрузка...</EmptyNote>}
                {status === 'ready' && contacts.length === 0 && (
                  <div className="flex flex-col items-center gap-2 px-8 py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
                      <Users size={22} />
                    </div>
                    <p className="text-[14px] leading-[1.5] text-slate-500">
                      Контактов пока нет. Найдите человека по имени пользователя выше.
                    </p>
                  </div>
                )}
                {contacts.map((contact) => (
                  <PeerRow key={contact.id} profile={contact} disabled={opening} onOpen={handleOpen} />
                ))}
              </Section>

              <Section title="Боты">
                {bareBots.length === 0 && <EmptyNote>Все боты уже в ваших контактах.</EmptyNote>}
                {bareBots.map((bot) => (
                  <PeerRow key={bot.id} profile={bot} disabled={opening} onOpen={handleOpen} />
                ))}
              </Section>
            </>
          )}
        </div>

        {opening && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-brand-500 backdrop-blur-[1px]">
            <Loader2 className="animate-spin" size={28} />
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pt-4">
      <h3 className="px-5 pb-2 text-[13px] font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="divide-y divide-slate-100 border-y border-slate-100 bg-white">{children}</div>
    </div>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="px-5 py-4 text-center text-[14px] text-slate-500">{children}</p>;
}

function PeerRow({
  profile,
  disabled,
  onOpen,
}: {
  profile: Profile;
  disabled: boolean;
  onOpen: (profile: Profile) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void onOpen(profile)}
      className="animate-rise-in flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60"
    >
      <Avatar name={profile.display_name} seed={profile.username} size={46} isBot={profile.is_bot} imageUrl={profile.avatar_url} />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-[16px] font-semibold text-slate-900">
          {profile.display_name}
          {profile.is_bot && <Bot size={14} className="shrink-0 text-brand-500" />}
        </p>
        <p className="truncate text-[14px] text-slate-500">@{profile.username}</p>
      </div>
    </button>
  );
}
