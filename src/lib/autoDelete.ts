import { supabase } from '@/lib/supabase';

export async function deleteOwnMessagesOlderThan(profileId: string, days: number): Promise<void> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { error } = await supabase.from('messages').delete().eq('sender_id', profileId).lt('created_at', cutoff);
  if (error) throw new Error(error.message);
}
