import { useEffect } from 'react';
import { deleteOwnMessagesOlderThan } from '@/lib/autoDelete';

const PURGE_INTERVAL_MS = 10 * 60_000;

export function useMessageAutoDelete(profileId: string | null, days: number | null, onError: (message: string) => void) {
  useEffect(() => {
    if (!profileId || days === null) return;
    const run = () => {
      deleteOwnMessagesOlderThan(profileId, days).catch(() => onError('Не удалось удалить старые сообщения.'));
    };
    run();
    const timer = window.setInterval(run, PURGE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [profileId, days, onError]);
}
