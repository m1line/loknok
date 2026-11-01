import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Message, MessageAttachment } from '@/lib/types';
import type { LoadStatus } from '@/hooks/useMyProfile';

const MESSAGE_COLUMNS = 'id, chat_id, sender_id, body, created_at, reply_to_id, sticker_url, media_url, media_kind, edited_at';

export function useChatMessages(chatId: string, myProfileId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<LoadStatus>('loading');

  const appendMessage = useCallback((incoming: Message) => {
    setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
  }, []);

  const replaceMessage = useCallback((updated: Message) => {
    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([
      supabase
        .from('messages')
        .select(MESSAGE_COLUMNS)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
        .limit(500),
      supabase.from('hidden_messages').select('message_id, messages!inner(chat_id)').eq('messages.chat_id', chatId),
    ]).then(([messagesResult, hiddenResult]) => {
      if (!active) return;
      if (messagesResult.error || !messagesResult.data || hiddenResult.error || !hiddenResult.data) {
        setStatus('error');
        return;
      }
      setMessages(messagesResult.data as Message[]);
      setHiddenIds(new Set((hiddenResult.data as { message_id: string }[]).map((row) => row.message_id)));
      setStatus('ready');
    });

    const channel = supabase
      .channel(`chat-messages-${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          if (active) appendMessage(payload.new as Message);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          if (active) replaceMessage(payload.new as Message);
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const removedId = (payload.old as { id?: string }).id;
        if (active && removedId) setMessages((prev) => prev.filter((m) => m.id !== removedId));
      })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [chatId, appendMessage, replaceMessage]);

  const send = useCallback(
    async (body: string, replyToId: string | null, attachment: MessageAttachment = {}): Promise<string | null> => {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          body,
          reply_to_id: replyToId,
          sticker_url: attachment.sticker_url ?? null,
          media_url: attachment.media_url ?? null,
          media_kind: attachment.media_kind ?? null,
        })
        .select(MESSAGE_COLUMNS)
        .single();

      if (error || !data) {
        return 'Не удалось отправить сообщение. Попробуйте еще раз.';
      }
      appendMessage(data as Message);
      return null;
    },
    [chatId, appendMessage]
  );

  const edit = useCallback(
    async (messageId: string, body: string): Promise<string | null> => {
      const { data, error } = await supabase
        .from('messages')
        .update({ body, edited_at: new Date().toISOString() })
        .eq('id', messageId)
        .select(MESSAGE_COLUMNS)
        .single();

      if (error || !data) return 'Не удалось изменить сообщение.';
      replaceMessage(data as Message);
      return null;
    },
    [replaceMessage]
  );

  const removeForEveryone = useCallback(async (messageId: string): Promise<string | null> => {
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) return 'Не удалось удалить сообщение.';
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    return null;
  }, []);

  const hideForMe = useCallback(
    async (messageId: string): Promise<string | null> => {
      const { error } = await supabase.from('hidden_messages').insert({ profile_id: myProfileId, message_id: messageId });
      if (error) return 'Не удалось удалить сообщение.';
      setHiddenIds((prev) => new Set(prev).add(messageId));
      return null;
    },
    [myProfileId]
  );

  const visibleMessages = useMemo(() => messages.filter((m) => !hiddenIds.has(m.id)), [messages, hiddenIds]);

  return { messages: visibleMessages, status, send, edit, removeForEveryone, hideForMe };
}
