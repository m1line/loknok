import { useState } from 'react';
import { Bot, MessageCircle, Loader2, Plus, RefreshCw, Search, X } from 'lucide-react';
import Avatar from '@/components/Avatar';
import NewChatSheet from '@/components/NewChatSheet';
import { formatListTime } from '@/lib/format';
import { useChatList } from '@/hooks/useChatList';
import type { Profile } from '@/lib/types';

interface ChatListScreenProps {
  myProfileId: string;
  onOpenChat: (chatId: string, peer: Profile) => void;
}

export default function ChatListScreen({ myProfileId, onOpenChat }: ChatListScreenProps) {
  const { chats, status, reload } = useChatList(myProfileId);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [composing, setComposing] = useState(false);

  const term = query.trim().toLowerCase();
  const visibleChats = term
    ? chats.filter(
        (chat) =>
          chat.peer.display_name.toLowerCase().includes(term) ||
          chat.peer.username.toLowerCase().includes(term) ||
          (chat.lastMessage?.body.toLowerCase().includes(term) ?? false)
      )
    : chats;

  const toggleSearch = () => {
    setSearchOpen((open) => !open);
    setQuery('');
  };

  return (
    <section className="flex h-full flex-col animate-fade-in">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/85 px-5 pb-3 pt-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-slate-900">Чаты</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSearch}
              aria-label={searchOpen ? 'Закрыть поиск' : 'Поиск чатов'}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-90"
            >
              {searchOpen ? <X size={20} /> : <Search size={20} />}
            </button>
            <button
              type="button"
              onClick={() => setComposing(true)}
              aria-label="Новый чат"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm transition hover:bg-brand-600 active:scale-90"
            >
              <Plus size={22} />
            </button>
          </div>
        </div>
        {searchOpen && (
          <label className="mt-3 flex h-10 items-center gap-2 rounded-xl bg-slate-100 px-3 animate-rise-in focus-within:bg-slate-200/70 focus-within:ring-4 focus-within:ring-brand-500/10">
            <Search size={18} className="shrink-0 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Имя, @username или текст сообщения"
              aria-label="Поиск по чатам"
              className="w-full bg-transparent text-[16px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </label>
        )}
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto">
        {status === 'loading' && (
          <div className="flex h-40 items-center justify-center text-slate-400">
            <Loader2 className="animate-spin" size={24} />
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
            <p className="text-[15px] text-slate-600">Не удалось загрузить чаты.</p>
            <button
              type="button"
              onClick={() => void reload()}
              className="flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2 text-[15px] font-medium text-white transition active:scale-95"
            >
              <RefreshCw size={16} /> Повторить
            </button>
          </div>
        )}

        {status === 'ready' && chats.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-8 py-20 text-center animate-rise-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <MessageCircle size={30} />
            </div>
            <p className="text-[17px] font-semibold text-slate-900">Пока нет чатов</p>
            <p className="text-[14px] leading-[1.5] text-slate-500">
              Откройте вкладку «Контакты», найдите человека или бота и начните переписку.
            </p>
          </div>
        )}

        {status === 'ready' && chats.length > 0 && visibleChats.length === 0 && (
          <p className="px-8 py-16 text-center text-[14px] text-slate-500">Ничего не нашлось по запросу «{query.trim()}».</p>
        )}

        {status === 'ready' && visibleChats.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {visibleChats.map((chat, index) => {
              const last = chat.lastMessage;
              const fromMe = last?.sender_id === myProfileId;
              return (
                <li key={chat.chatId} className="animate-rise-in" style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}>
                  <button
                    type="button"
                    onClick={() => onOpenChat(chat.chatId, chat.peer)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors duration-150 hover:bg-slate-50 active:bg-slate-100"
                  >
                    <Avatar name={chat.peer.display_name} seed={chat.peer.username} size={54} isBot={chat.peer.is_bot} imageUrl={chat.peer.avatar_url} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-[16px] font-semibold text-slate-900">{chat.peer.display_name}</span>
                          {chat.peer.is_bot && <Bot size={15} className="shrink-0 text-brand-500" />}
                        </span>
                        {last && (
                          <span className="shrink-0 text-[13px] text-slate-400">{formatListTime(last.created_at)}</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-[14px] text-slate-500">
                        {last ? (
                          <>
                            {fromMe && <span className="text-slate-400">Вы: </span>}
                            {last.body}
                          </>
                        ) : (
                          'Нет сообщений'
                        )}
                        </p>
                        {chat.unreadCount > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[12px] font-semibold text-white">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {composing && (
        <NewChatSheet
          myProfileId={myProfileId}
          onOpenChat={(chatId, peer) => {
            setComposing(false);
            onOpenChat(chatId, peer);
          }}
          onClose={() => setComposing(false)}
        />
      )}
    </section>
  );
}
