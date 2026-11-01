import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PROFILE_COLUMNS, type ChatSummary, type Message, type Profile } from '@/lib/types';
import type { LoadStatus } from '@/hooks/useMyProfile';

interface MembershipRow {
  chat_id: string;
  profile_id: string;
  profile: Profile | null;
}

interface ReadRow {
  chat_id: string;
  last_read_at: string;
}

const NEVER_READ = '1970-01-01T00:00:00Z';

export function useChatList(myProfileId: string) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');

  const load = useCallback(async () => {
    const [{ data: memberships, error }, { data: reads }] = await Promise.all([
      supabase.from('chat_members').select(`chat_id, profile_id, profile:profiles(${PROFILE_COLUMNS})`),
      supabase.from('chat_reads').select('chat_id, last_read_at').eq('profile_id', myProfileId),
    ]);

    if (error || !memberships) {
      setStatus('error');
      return;
    }

    const readByChat = new Map<string, string>();
    for (const row of (reads ?? []) as ReadRow[]) {
      readByChat.set(row.chat_id, row.last_read_at);
    }

    const rows = memberships as unknown as MembershipRow[];
    const peerByChat = new Map<string, Profile>();
    for (const row of rows) {
      if (row.profile_id !== myProfileId && row.profile) {
        peerByChat.set(row.chat_id, row.profile);
      }
    }

    const summaries = await Promise.all(
      Array.from(peerByChat.entries()).map(async ([chatId, peer]) => {
        const [{ data: last }, { count }] = await Promise.all([
          supabase
            .from('messages')
            .select('id, chat_id, sender_id, body, created_at, reply_to_id, sticker_url, media_url, media_kind')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('chat_id', chatId)
            .eq('sender_id', peer.id)
            .gt('created_at', readByChat.get(chatId) ?? NEVER_READ),
        ]);
        return {
          chatId,
          peer,
          lastMessage: (last as Message | null) ?? null,
          unreadCount: count ?? 0,
        };
      })
    );

    summaries.sort((a, b) => {
      const at = a.lastMessage?.created_at ?? '';
      const bt = b.lastMessage?.created_at ?? '';
      return bt.localeCompare(at);
    });

    setChats(summaries);
    setStatus('ready');
  }, [myProfileId]);

  useEffect(() => {
    void load();

    const channel = supabase
      .channel(`chat-list-${myProfileId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        void load();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_members' }, () => {
        void load();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, () => {
        void load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reads' }, () => {
        void load();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, myProfileId]);

  return { chats, status, reload: load };
}
