import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import AppLockScreen from '@/components/AppLockScreen';
import MessengerHome from '@/components/MessengerHome';
import { useAppLock } from '@/hooks/useAppLock';
import { useDeviceSession } from '@/hooks/useDeviceSession';
import { useMessageAutoDelete } from '@/hooks/useMessageAutoDelete';
import { useMyProfile } from '@/hooks/useMyProfile';

interface Toast {
  key: number;
  text: string;
}

export default function Messenger({ userId }: { userId: string }) {
  const appLock = useAppLock();
  const { profile, status, reload, setProfile } = useMyProfile(userId);
  const [toast, setToast] = useState<Toast | null>(null);
  const darkTheme = profile?.preferences.darkTheme ?? false;

  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', darkTheme);
    return () => document.documentElement.classList.remove('theme-dark');
  }, [darkTheme]);

  const notify = useCallback((text: string) => {
    setToast({ key: Date.now(), text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useDeviceSession(profile?.id ?? null, profile?.preferences.inactiveSessionDays ?? 30);
  useMessageAutoDelete(profile?.id ?? null, profile?.preferences.autoDeleteDays ?? null, notify);

  if (appLock.locked) return <AppLockScreen onUnlock={appLock.unlock} />;

  if (status === 'loading') {
    return (
      <CenteredState>
        <Loader2 size={28} className="animate-spin text-brand-500" />
      </CenteredState>
    );
  }

  if (status === 'error' || !profile) {
    return (
      <CenteredState>
        <AlertCircle size={36} className="text-red-500" />
        <p className="text-[15px] text-slate-600">Не удалось загрузить ваш профиль.</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2 text-[15px] font-medium text-white transition active:scale-95"
        >
          <RefreshCw size={16} /> Повторить
        </button>
      </CenteredState>
    );
  }

  return (
    <MessengerHome
      profile={profile}
      setProfile={setProfile}
      appLock={appLock}
      notify={notify}
      toast={toast}
    />
  );
}

function CenteredState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center text-slate-500">
      {children}
    </div>
  );
}
