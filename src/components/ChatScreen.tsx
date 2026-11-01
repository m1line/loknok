import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Bot, Loader2, Pencil, Phone, Reply, Send, Smile, Video, X, type LucideIcon } from 'lucide-react';
import Avatar from '@/components/Avatar';
import MediaRecordButton from '@/components/chat/MediaRecordButton';
import MessageActionBar from '@/components/chat/MessageActionBar';
import MessageList from '@/components/chat/MessageList';
import StickerPicker from '@/components/chat/StickerPicker';
import ProfileSheet from '@/components/ProfileSheet';
import { wallpaperStyle } from '@/lib/preferences';
import type { CallKind } from '@/lib/calls';
import { uploadChatMedia } from '@/lib/storage';
import type { ReactionEmoji } from '@/lib/reactions';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useChatReads } from '@/hooks/useChatReads';
import { useMediaRecorder, type RecordedMedia } from '@/hooks/useMediaRecorder';
import { useMessageReactions } from '@/hooks/useMessageReactions';
import type { MediaKind, Message, MyProfile, Profile } from '@/lib/types';

interface ChatScreenProps {
  chatId: string;
  peer: Profile;
  me: MyProfile;
  onBack: () => void;
  onStartCall: (peer: Profile, kind: CallKind) => Promise<string | null>;
}

export default function ChatScreen({ chatId, peer, me, onBack, onStartCall }: ChatScreenProps) {
  const { messages, status, send, edit, removeForEveryone, hideForMe } = useChatMessages(chatId, me.id);
  const { summaries, toggle } = useMessageReactions(chatId, me.id);
  const { peerReadAt, markRead } = useChatReads(chatId, me.id, peer.id);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [recordMode, setRecordMode] = useState<MediaKind>('voice');
  const [profileOpen, setProfileOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const prefs = me.preferences;

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: messages.length > 1 ? 'smooth' : 'auto' });
  }, [messages.length]);

  useEffect(() => {
    if (status === 'ready') void markRead();
  }, [status, messages.length, markRead]);

  const fromPeerCount = messages.filter((message) => message.sender_id === peer.id).length;
  const fromMeCount = messages.length - fromPeerCount;

  const canSend = draft.trim().length > 0 && !sending;
  const authorOf = (message: Message) => (message.sender_id === me.id ? me.display_name : peer.display_name);

  const sendMessage = async (body: string, attachment: Parameters<typeof send>[2] = {}) => {
    setSending(true);
    setError(null);
    const failure = await send(body, replyTo?.id ?? null, attachment);
    setSending(false);
    if (failure) {
      setError(failure);
      return false;
    }
    setReplyTo(null);
    return true;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    if (editing) {
      setSending(true);
      setError(null);
      const failure = await edit(editing.id, body);
      setSending(false);
      if (failure) {
        setError(failure);
        return;
      }
      setEditing(null);
      setDraft('');
      return;
    }
    if (await sendMessage(body)) setDraft('');
  };

  const handleSendSticker = async (stickerUrl: string) => {
    if (sending) return;
    setStickersOpen(false);
    await sendMessage('', { sticker_url: stickerUrl });
  };

  const handleRecorded = async (media: RecordedMedia) => {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const mediaUrl = await uploadChatMedia(me.id, media.blob, media.extension);
      const failure = await send('', replyTo?.id ?? null, { media_url: mediaUrl, media_kind: media.kind });
      if (failure) {
        setError(failure);
        return;
      }
      setReplyTo(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось отправить запись.');
    } finally {
      setSending(false);
    }
  };

  const handleReact = async (messageId: string, emoji: ReactionEmoji) => {
    setActionMessage(null);
    const failure = await toggle(messageId, emoji);
    if (failure) setError(failure);
  };

  const handleCall = async (kind: CallKind) => {
    const failure = await onStartCall(peer, kind);
    if (failure) setError(failure);
  };

  const isEditable = (message: Message) => message.sender_id === me.id && !message.sticker_url && !message.media_url;

  const handleQuickReact = (messageId: string) => {
    void handleReact(messageId, prefs.quickReaction);
  };

  const handleCopy = async (message: Message) => {
    setActionMessage(null);
    try {
      await navigator.clipboard.writeText(message.body);
    } catch {
      setError('Не удалось скопировать текст.');
    }
  };

  const handleHideForMe = async (message: Message) => {
    if (!window.confirm('Удалить сообщение только у вас? У собеседника оно останется.')) return;
    setActionMessage(null);
    const failure = await hideForMe(message.id);
    if (failure) setError(failure);
  };

  const handleDeleteForAll = async (message: Message) => {
    if (!window.confirm('Удалить сообщение у всех участников чата?')) return;
    setActionMessage(null);
    const failure = await removeForEveryone(message.id);
    if (failure) setError(failure);
  };

  const startReply = (message: Message) => {
    setEditing(null);
    setReplyTo(message);
    setActionMessage(null);
  };

  const startEdit = (message: Message) => {
    setReplyTo(null);
    setEditing(message);
    setDraft(message.body);
    setActionMessage(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft('');
  };

  return (
    <section className="relative flex h-full flex-col bg-white animate-screen-in">
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white/90 px-2 py-2 backdrop-blur-xl">
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад"
          className="flex h-10 w-10 items-center justify-center rounded-full text-brand-500 transition hover:bg-brand-50 active:scale-90"
        >
          <ArrowLeft size={24} />
        </button>
      <button
          type="button"
          onClick={() => setProfileOpen(true)}
          aria-label="Открыть профиль"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl text-left transition active:opacity-70"
        >
          <Avatar name={peer.display_name} seed={peer.username} size={38} isBot={peer.is_bot} imageUrl={peer.avatar_url} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-[16px] font-semibold leading-[1.2] text-slate-900">
              {peer.display_name}
              {peer.is_bot && <Bot size={14} className="shrink-0 text-brand-500" />}
            </p>
            <p className="truncate text-[13px] text-slate-500">
              {peer.is_bot ? 'бот' : `@${peer.username} · от друга: ${fromPeerCount} · от вас: ${fromMeCount}`}
            </p>
          </div>
        </button>
        {!peer.is_bot && (
          <>
            <button
              type="button"
              onClick={() => void handleCall('audio')}
              aria-label="Аудиозвонок"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-brand-500 transition hover:bg-brand-50 active:scale-90"
            >
              <Phone size={22} />
            </button>
            <button
              type="button"
              onClick={() => void handleCall('video')}
              aria-label="Видеозвонок"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-brand-500 transition hover:bg-brand-50 active:scale-90"
            >
              <Video size={22} />
            </button>
          </>
        )}
      </header>

      <div className="relative min-h-0 flex-1" style={wallpaperStyle(prefs.wallpaper)}>
        {prefs.nightMode && <div className="pointer-events-none absolute inset-0 bg-slate-950/40" />}
        <div ref={listRef} className="no-scrollbar relative h-full overflow-y-auto px-3 py-4">
          {status === 'loading' && (
            <div className="flex h-full items-center justify-center text-slate-500">
              <Loader2 className="animate-spin" size={24} />
            </div>
          )}
          {status === 'error' && (
            <p className="rounded-xl bg-white/80 px-4 py-3 text-center text-[14px] text-red-700">
              Не удалось загрузить сообщения.
            </p>
          )}
          {status === 'ready' && messages.length === 0 && (
            <p className="mt-16 flex justify-center">
              <span className="rounded-full bg-white/80 px-4 py-2 text-center text-[14px] text-slate-700 shadow-sm">
                Сообщений пока нет. Напишите первым.
              </span>
            </p>
          )}
          {status === 'ready' && (
            <MessageList
              messages={messages}
              myProfileId={me.id}
              authorOf={authorOf}
              look={{
                textSize: prefs.textSize,
                bubbleColor: prefs.bubbleColor,
                nightMode: prefs.nightMode || prefs.darkTheme,
                animate: prefs.animations,
              }}
              reactions={summaries}
              peerReadAt={peerReadAt}
              onOpenActions={setActionMessage}
              onToggleReaction={(messageId, emoji) => void handleReact(messageId, emoji)}
              onQuickReact={handleQuickReact}
              onReply={startReply}
            />
          )}
        </div>
      </div>

      <div className="relative shrink-0 border-t border-slate-200 bg-white/95 px-3 pb-6 pt-2 backdrop-blur-xl">
        {stickersOpen && (
          <StickerPicker profileId={me.id} onPick={handleSendSticker} onClose={() => setStickersOpen(false)} />
        )}
        {actionMessage && (
          <MessageActionBar
            onReact={(emoji) => void handleReact(actionMessage.id, emoji)}
            onReply={() => startReply(actionMessage)}
            onCopy={actionMessage.body ? () => void handleCopy(actionMessage) : undefined}
            onEdit={isEditable(actionMessage) ? () => startEdit(actionMessage) : undefined}
            onHideForMe={() => void handleHideForMe(actionMessage)}
            onDeleteForAll={actionMessage.sender_id === me.id ? () => void handleDeleteForAll(actionMessage) : undefined}
            onClose={() => setActionMessage(null)}
          />
        )}
        {replyTo && (
          <ComposerBanner
            icon={Reply}
            title={authorOf(replyTo)}
            text={replyTo.body || 'Медиа'}
            label="Отменить ответ"
            onCancel={() => setReplyTo(null)}
          />
        )}
        {editing && (
          <ComposerBanner
            icon={Pencil}
            title="Редактирование"
            text={editing.body}
            label="Отменить редактирование"
            onCancel={cancelEdit}
          />
        )}
        {error && (
          <p role="alert" className="animate-rise-in px-2 pb-2 text-[13px] text-red-600">
            {error}
          </p>
        )}
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setStickersOpen((open) => !open)}
            aria-label="Стикеры"
            aria-expanded={stickersOpen}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-90 ${
              stickersOpen ? 'bg-brand-500 text-white' : 'text-brand-500 hover:bg-brand-50'
            }`}
          >
            <Smile size={22} />
          </button>
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            maxLength={4000}
            placeholder="Сообщение"
            aria-label="Текст сообщения"
            className="min-h-10 flex-1 rounded-full border border-slate-200 bg-slate-100 px-4 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400 transition focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
          />
          {canSend || sending ? (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Отправить"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-md shadow-brand-500/30 transition-all duration-200 hover:bg-brand-600 active:scale-90 disabled:bg-slate-300 disabled:shadow-none"
            >
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="-ml-0.5" />}
            </button>
          ) : (
            <MediaRecordButton
              mode={recordMode}
              onModeChange={setRecordMode}
              onRecorded={(media) => void handleRecorded(media)}
              onError={setError}
            />
          )}
        </form>
      </div>
      {profileOpen && <ProfileSheet profile={peer} onClose={() => setProfileOpen(false)} />}
    </section>
  );
}

function ComposerBanner({
  icon: Icon,
  title,
  text,
  label,
  onCancel,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  label: string;
  onCancel: () => void;
}) {
  return (
    <div className="mb-2 flex animate-rise-in items-center gap-3 rounded-xl border-l-2 border-brand-500 bg-slate-50 px-3 py-2">
      <Icon size={16} className="shrink-0 text-brand-500" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-brand-600">{title}</p>
        <p className="truncate text-[13px] text-slate-600">{text}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label={label}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200 active:scale-90"
      >
        <X size={16} />
      </button>
    </div>
  );
}
