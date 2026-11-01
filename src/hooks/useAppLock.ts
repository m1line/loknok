import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkPasscode,
  createPasscodeRecord,
  loadAppLockSettings,
  saveAppLockSettings,
  type AppLockSettings,
  type AutoLockMinutes,
} from '@/lib/appLock';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;
const IDLE_CHECK_MS = 5_000;

export function useAppLock() {
  const [settings, setSettings] = useState<AppLockSettings>(loadAppLockSettings);
  const [locked, setLocked] = useState(settings.passcodeHash !== null);
  const lastActive = useRef(Date.now());
  const hasPasscode = settings.passcodeHash !== null;
  const autoLockMinutes = settings.autoLockMinutes;

  useEffect(() => {
    if (!hasPasscode || autoLockMinutes === 0) return;
    const touch = () => {
      lastActive.current = Date.now();
    };
    touch();
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, touch, { passive: true }));
    const timer = window.setInterval(() => {
      if (Date.now() - lastActive.current >= autoLockMinutes * 60_000) setLocked(true);
    }, IDLE_CHECK_MS);
    return () => {
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, touch));
      window.clearInterval(timer);
    };
  }, [hasPasscode, autoLockMinutes]);

  const updateSettings = useCallback((next: AppLockSettings) => {
    saveAppLockSettings(next);
    setSettings(next);
  }, []);

  const verify = useCallback(
    async (passcode: string) => {
      const { passcodeHash, salt } = settings;
      if (passcodeHash === null || salt === null) return false;
      return checkPasscode(passcode, { passcodeHash, salt });
    },
    [settings],
  );

  const unlock = useCallback(
    async (passcode: string) => {
      const ok = await verify(passcode);
      if (ok) {
        lastActive.current = Date.now();
        setLocked(false);
      }
      return ok;
    },
    [verify],
  );

  const setPasscode = useCallback(
    async (passcode: string) => {
      const record = await createPasscodeRecord(passcode);
      updateSettings({ ...settings, ...record });
    },
    [settings, updateSettings],
  );

  const removePasscode = useCallback(() => {
    updateSettings({ ...settings, passcodeHash: null, salt: null });
    setLocked(false);
  }, [settings, updateSettings]);

  const setAutoLock = useCallback(
    (minutes: AutoLockMinutes) => updateSettings({ ...settings, autoLockMinutes: minutes }),
    [settings, updateSettings],
  );

  const lockNow = useCallback(() => setLocked(true), []);

  return {
    locked,
    hasPasscode,
    autoLockMinutes,
    verify,
    unlock,
    setPasscode,
    removePasscode,
    setAutoLock,
    lockNow,
  };
}

export type AppLock = ReturnType<typeof useAppLock>;
