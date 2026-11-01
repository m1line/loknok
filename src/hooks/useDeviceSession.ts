import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { removeInactiveDevices, touchDevice } from '@/lib/devices';

const HEARTBEAT_MS = 60_000;

export function useDeviceSession(profileId: string | null, inactiveSessionDays: number) {
  useEffect(() => {
    if (!profileId) return;

    const beat = async () => {
      try {
        const result = await touchDevice(profileId);

        if (result === 'revoked') {
          await supabase.auth.signOut();
          return;
        }

        await removeInactiveDevices(profileId, inactiveSessionDays);
      } catch {
        return;
      }
    };

    void beat();

    const timer = window.setInterval(() => void beat(), HEARTBEAT_MS);

    return () => window.clearInterval(timer);
  }, [profileId, inactiveSessionDays]);
}
