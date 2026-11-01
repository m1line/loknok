import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { REACTION_EMOJIS, summarizeReactions, type ReactionEmoji, type ReactionSummary } from '@/lib/reactions';
import type { MessageReactionRow } from '@/lib/types';

export function useMessageReactions(chatId: string, myProfileId: string) {
  const [rows, setRows] = useState<MessageReactionRow[]>([]);

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('message_reactions')
      .select('message_id, profile_id, emoji, messages!inner(chat_id)')
      .eq('messages.chat_id', chatId);
    if (error || !data) return;
    setRows(data.map((row) => ({ message_id: row.message_id, profile_id: row.profile_id, emoji: row.emoji })));
  }, [chatId]);

  useEffect(() => {
    void reload();
    const channel = supabase
      .channel(`chat-reactions-${chatId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => {
        void reload();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatId, reload]);

  const summaries: Map<string, ReactionSummary[]> = summarizeReactions(rows, myProfileId);

  const toggle = useCallback(
    async (messageId: string, emoji: ReactionEmoji): Promise<string | null> => {
      const mine = rows.some((r) => r.message_id === messageId && r.profile_id === myProfileId && r.emoji === emoji);
      const request = mine
        ? supabase
            .from('message_reactions')
            .delete()
            .eq('message_id', messageId)
            .eq('profile_id', myProfileId)
            .eq('emoji', emoji)
        : supabase.from('message_reactions').insert({ message_id: messageId, profile_id: myProfileId, emoji });
      const { error } = await request;
      if (error) return 'Не удалось поставить реакцию.';
      await reload();
      return null;
    },
    [rows, myProfileId, reload]
  );

  return { summaries, toggle, emojis: REACTION_EMOJIS };
}
