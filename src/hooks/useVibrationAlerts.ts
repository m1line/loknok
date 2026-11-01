import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { vibrate } from '@/lib/haptics';

const MESSAGE_PULSE = 120;
const CALL_PULSE = [400, 200, 400];
const CALL_PULSE_INTERVAL_MS = 2500;

export function useMessageVibration(myId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`incoming-messages:${myId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const message = payload.new as { sender_id?: string };
        if (message.sender_id && message.sender_id !== myId) vibrate(MESSAGE_PULSE);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [myId, enabled]);
}

export function useCallVibration(enabled: boolean, ringing: boolean) {
  useEffect(() => {
    if (!enabled || !ringing) return;
    vibrate(CALL_PULSE);
    const timer = window.setInterval(() => vibrate(CALL_PULSE), CALL_PULSE_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      vibrate(0);
    };
  }, [enabled, ringing]);
}
