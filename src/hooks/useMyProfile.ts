import { useCallback, useEffect, useState } from 'react';
import { loadMyProfile } from '@/lib/profiles';
import type { MyProfile } from '@/lib/types';

export type LoadStatus = 'loading' | 'ready' | 'error';

export function useMyProfile(userId: string) {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await loadMyProfile(userId);
      if (!data) {
        setStatus('error');
        return;
      }
      setProfile(data);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { profile, status, reload: load, setProfile };
}
