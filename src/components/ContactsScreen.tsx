import { useEffect, useState, type ReactNode } from 'react';
import { Bot, Check, Search, UserPlus, Users, X } from 'lucide-react';
import Avatar from '@/components/Avatar';
import ProfileSheet from '@/components/ProfileSheet';
import { useContacts } from '@/hooks/useContacts';
import { fetchBots, openDirectChat, searchProfiles } from '@/lib/profiles';
import type { Profile } from '@/lib/types';

interface ContactsScreenProps {
  myProfileId: string;
  onOpenChat: (chatId: string, peer: Profile) => void;
  onError: (message: string) => void;
}

export default function ContactsScreen({ myProfileId, onOpenChat, onError }: ContactsScreenProps) {
  const { contacts, status, addContact, removeContact } = useContacts(myProfileId);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [bots, setBots] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);

  const contactIds = new Set(contacts.map((c) => c.id));
  const trimmedQuery = query.trim();

  useEffect(() => {
    let active = true;
    fetchBots()
      .then((list) => {
        if (active) setBots(list);
      })
      .catch(() => {
        if (active) onError('Не удалось загрузить ботов');
      });
    return () => {
      active = false;
    };
  }, [onError]);

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
          if (active) onError(err.message);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [trimmedQuery, myProfileId, onError]);

  const runAction = async (action: () => Promise<string | null>) => {
    setBusy(true);
    const failure = await action();
    setBusy(false);
    if (failure) onError(failure);
  };

  const handleMessage = async (profile: Profile) => {
    setBusy(true);
    try {
      const chatId = await openDirectChat(profile.id);
      setSelected(null);
      onOpenChat(chatId, profile);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Не удалось открыть чат');
    } finally {
      setBusy(false);
    }
  };

  const showingSearch = trimmedQuery.length > 0;
  const bareBots = bots.filter((bot) => !contactIds.has(bot.id));

  return (
    <section className="relative flex h-full flex-col animate-fade-in">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/85 px-5 pb-3 pt-3 backdrop-blur-xl">
        <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-slate-900">Контакты</h1>
        <label className="mt-3 flex h-10 items-center gap-2 rounded-xl bg-slate-100 px-3 transition focus-within:bg-slate-200/70 focus-within:ring-4 focus-within:ring-brand-500/10">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по @username"
            aria-label="Поиск по имени пользователя"
            className="w-full bg-transparent text-[16px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Очистить поиск"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-400 text-white transition active:scale-90"
            >
              <X size={14} />
            </button>
          )}
        </label>
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto pb-6">
        {showingSearch ? (
          <Section title="Результаты поиска">
            {searching && results.length === 0 && <p className="px-5 py-6 text-center text-[14px] text-slate-500">Ищем...</p>}
            {!searching && results.length === 0 && (
              <p className="px-5 py-6 text-center text-[14px] text-slate-500">Никого не нашли по этому имени.</p>
            )}
            {results.map((profile) => (
              <ProfileRow
                key={profile.id}
                profile={profile}
                onOpen={() => setSelected(profile)}
                action={
                  contactIds.has(profile.id) ? (
                    <span className="flex items-center gap-1 text-[13px] font-medium text-emerald-600">
                      <Check size={16} /> В контактах
                    </span>
                  ) : (
                    <AddButton
                      disabled={busy}
                      onClick={() => void runAction(() => addContact(profile.id))}
                    />
                  )
                }
              />
            ))}
          </Section>
        ) : (
          <>
            <Section title="Боты">
              {bareBots.length === 0 && (
                <p className="px-5 py-3 text-[14px] text-slate-500">Все боты уже в ваших контактах.</p>
              )}
              {bareBots.map((bot) => (
                <ProfileRow
                  key={bot.id}
                  profile={bot}
                  onOpen={() => setSelected(bot)}
                  action={<AddButton disabled={busy} onClick={() => void runAction(() => addContact(bot.id))} />}
                />
              ))}
            </Section>

            <Section title="Контакты">
              {status === 'loading' && <p className="px-5 py-3 text-[14px] text-slate-500">Загрузка...</p>}
              {status === 'ready' && contacts.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-8 py-10 text-center animate-rise-in">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-500">
                    <Users size={26} />
                  </div>
                  <p className="text-[15px] font-semibold text-slate-900">Контактов пока нет</p>
                  <p className="text-[14px] leading-[1.5] text-slate-500">
                    Найдите человека по имени пользователя или добавьте одного из ботов выше.
                  </p>
                </div>
              )}
              {contacts.map((contact) => (
                <ProfileRow key={contact.id} profile={contact} onOpen={() => setSelected(contact)} />
              ))}
            </Section>
          </>
        )}
      </div>

      {selected && (
        <ProfileSheet
          profile={selected}
          isContact={contactIds.has(selected.id)}
          busy={busy}
          onClose={() => setSelected(null)}
          onMessage={() => void handleMessage(selected)}
          onToggleContact={() =>
            void runAction(async () => {
              const failure = contactIds.has(selected.id)
                ? await removeContact(selected.id)
                : await addContact(selected.id);
              if (!failure) setSelected(null);
              return failure;
            })
          }
        />
      )}
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pt-4">
      <h2 className="px-5 pb-2 text-[13px] font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="divide-y divide-slate-100 border-y border-slate-100 bg-white">{children}</div>
    </div>
  );
}

function ProfileRow({
  profile,
  onOpen,
  action,
}: {
  profile: Profile;
  onOpen: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="animate-rise-in flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-70">
        <Avatar name={profile.display_name} seed={profile.username} size={46} isBot={profile.is_bot} imageUrl={profile.avatar_url} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-[16px] font-semibold text-slate-900">
            {profile.display_name}
            {profile.is_bot && <Bot size={14} className="shrink-0 text-brand-500" />}
          </p>
          <p className="truncate text-[14px] text-slate-500">@{profile.username}</p>
        </div>
      </button>
      {action}
    </div>
  );
}

function AddButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Добавить в контакты"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition active:scale-90 hover:bg-brand-100 disabled:opacity-50"
    >
      <UserPlus size={18} />
    </button>
  );
}
