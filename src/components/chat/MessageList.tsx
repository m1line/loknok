import { useEffect, useRef } from 'react';
import { Smile } from 'lucide-react';
import CircleVideo from '@/components/chat/CircleVideo';
import MessageBubble, { type BubbleLook } from '@/components/chat/MessageBubble';
import SwipeToReply from '@/components/chat/SwipeToReply';
import { formatClock, formatDayLabel, isSameDay } from '@/lib/format';
import type { ReactionSummary } from '@/lib/reactions';
import type { Message } from '@/lib/types';

const DOUBLE_TAP_MS = 280;

interface MessageListProps {
  messages: Message[];
  myProfileId: string;
  authorOf: (message: Message) => string;
  look: BubbleLook;
  reactions: Map<string, ReactionSummary[]>;
  peerReadAt: string | null;
  onOpenActions: (message: Message) => void;
  onToggleReaction: (messageId: string, emoji: ReactionSummary['emoji']) => void;
  onQuickReact: (messageId: string) => void;
  onReply: (message: Message) => void;
}

export default function MessageList({
  messages,
  myProfileId,
  authorOf,
  look,
  reactions,
  peerReadAt,
  onOpenActions,
  onToggleReaction,
  onQuickReact,
  onReply,
}: MessageListProps) {
  const pendingTap = useRef<{ messageId: string; timer: number } | null>(null);

  useEffect(() => {
    return () => {
      if (pendingTap.current) window.clearTimeout(pendingTap.current.timer);
    };
  }, []);

  const handleTap = (message: Message) => {
    const pending = pendingTap.current;
    if (pending && pending.messageId === message.id) {
      window.clearTimeout(pending.timer);
      pendingTap.current = null;
      onQuickReact(message.id);
      return;
    }
    if (pending) window.clearTimeout(pending.timer);
    const timer = window.setTimeout(() => {
      pendingTap.current = null;
      onOpenActions(message);
    }, DOUBLE_TAP_MS);
    pendingTap.current = { messageId: message.id, timer };
  };

  const isRead = (message: Message) =>
    peerReadAt !== null && new Date(peerReadAt).getTime() >= new Date(message.created_at).getTime();
  const lastOwnId = [...messages].reverse().find((m) => m.sender_id === myProfileId)?.id;

  return (
    <div className="flex flex-col gap-1">
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const showDay = !previous || !isSameDay(previous.created_at, message.created_at);
        const mine = message.sender_id === myProfileId;
        const groupStart = !previous || previous.sender_id !== message.sender_id || showDay;
        const parent = message.reply_to_id ? messages.find((m) => m.id === message.reply_to_id) : undefined;
        const messageReactions = reactions.get(message.id) ?? [];
        return (
          <div key={message.id}>
            {showDay && (
              <div className="my-3 flex justify-center">
                <span className="rounded-full bg-white/80 px-3 py-1 text-[12px] font-medium text-slate-700 shadow-sm">
                  {formatDayLabel(message.created_at)}
                </span>
              </div>
            )}
            <SwipeToReply onReply={() => onReply(message)}>
              <div className={`flex items-center gap-1 ${mine ? 'justify-end' : 'justify-start'} ${groupStart ? 'mt-1.5' : ''}`}>
                {mine && <ActionsButton onClick={() => onOpenActions(message)} />}
                <div className={`flex min-w-0 flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  <MessageContent
                    message={message}
                    mine={mine}
                    parentText={parent ? authorOf(parent) : null}
                    parentBody={parent?.body ?? null}
                    hasParent={Boolean(message.reply_to_id)}
                    look={look}
                    onTap={() => handleTap(message)}
                  />
                  {messageReactions.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {messageReactions.map((reaction) => (
                        <button
                          key={reaction.emoji}
                          type="button"
                          onClick={() => onToggleReaction(message.id, reaction.emoji)}
                          className={`flex h-7 items-center gap-1 rounded-full px-2 text-[13px] shadow-sm ring-1 transition active:scale-95 ${
                            reaction.mine ? 'bg-brand-50 ring-brand-400 text-brand-700' : 'bg-white ring-slate-200 text-slate-700'
                          }`}
                        >
                          <span>{reaction.emoji}</span>
                          <span className="text-[12px] font-semibold">{reaction.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {message.id === lastOwnId && (
                    <span className="mt-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-slate-700">
                      {isRead(message) ? 'Просмотрено' : 'Отправлено'}
                    </span>
                  )}
                </div>
                {!mine && <ActionsButton onClick={() => onOpenActions(message)} />}
              </div>
            </SwipeToReply>
          </div>
        );
      })}
    </div>
  );
}

function ActionsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Действия с сообщением"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 opacity-60 transition hover:bg-white/70 hover:opacity-100 active:scale-90"
    >
      <Smile size={16} />
    </button>
  );
}

function MessageContent({
  message,
  mine,
  parentText,
  parentBody,
  hasParent,
  look,
  onTap,
}: {
  message: Message;
  mine: boolean;
  parentText: string | null;
  parentBody: string | null;
  hasParent: boolean;
  look: BubbleLook;
  onTap: () => void;
}) {
  if (message.sticker_url) {
    return (
      <button type="button" onClick={onTap} className="flex flex-col items-center gap-1 rounded-2xl p-1 transition active:scale-95">
        <img src={message.sticker_url} alt="Стикер" className="h-32 w-32 object-contain" />
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-slate-700">{formatClock(message.created_at)}</span>
      </button>
    );
  }

  if (message.media_kind === 'circle' && message.media_url) {
    return (
      <div className="flex flex-col items-center gap-1">
        <CircleVideo src={message.media_url} />
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-slate-700">{formatClock(message.created_at)}</span>
      </div>
    );
  }

  if (message.media_kind === 'voice' && message.media_url) {
    return (
      <div className={`rounded-2xl px-3 py-2 shadow-sm ${mine ? 'bg-brand-500' : 'bg-white'}`}>
        <audio src={message.media_url} controls preload="metadata" className="h-10 w-56 max-w-full" />
        <p className={`mt-0.5 text-right text-[11px] ${mine ? 'text-white/80' : 'text-slate-500'}`}>{formatClock(message.created_at)}</p>
      </div>
    );
  }

  const clock = formatClock(message.created_at);
  return (
    <MessageBubble
      text={message.body}
      time={message.edited_at ? `ред. ${clock}` : clock}
      mine={mine}
      quote={hasParent ? { author: parentText ?? 'Сообщение', text: parentBody ?? 'Сообщение недоступно' } : null}
      onClick={onTap}
      {...look}
    />
  );
}
