import { useEffect, useState } from 'react';
import {
  clearInstallPrompt,
  getInstallPrompt,
  isStandalone,
  subscribeInstallPrompt,
} from '@/lib/pwa';

export function useInstallPrompt() {
  const [standalone, setStandalone] = useState(isStandalone);
  const [deferred, setDeferred] = useState(getInstallPrompt);

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const syncStandalone = () => setStandalone(isStandalone());
    const unsubscribe = subscribeInstallPrompt(() => {
      setDeferred(getInstallPrompt());
      syncStandalone();
    });

    displayMode.addEventListener('change', syncStandalone);
    return () => {
      displayMode.removeEventListener('change', syncStandalone);
      unsubscribe();
    };
  }, []);

  return { standalone, deferred, clearDeferred: clearInstallPrompt };
}
