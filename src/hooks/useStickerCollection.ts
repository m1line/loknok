import { useCallback, useEffect, useState } from 'react';
import { fetchStickerCollection, type StickerCollection } from '@/lib/stickers';
import type { LoadStatus } from '@/hooks/useMyProfile';

export function useStickerCollection(profileId: string) {
  const [collection, setCollection] = useState<StickerCollection | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');

  const reload = useCallback(async () => {
    try {
      setCollection(await fetchStickerCollection(profileId));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [profileId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { collection, status, reload };
}
