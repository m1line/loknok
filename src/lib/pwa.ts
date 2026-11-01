export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// The install event fires once during page load, often before any screen mounts,
// so it is captured at startup and held here for components to read.
let installPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();

function notifyInstallListeners() {
  installListeners.forEach((listener) => listener());
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  const isIphoneOrIpad = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isIpadDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isIphoneOrIpad || isIpadDesktopMode;
}

export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event as BeforeInstallPromptEvent;
    notifyInstallListeners();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    notifyInstallListeners();
  });
}

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return installPrompt;
}

export function clearInstallPrompt(): void {
  installPrompt = null;
  notifyInstallListeners();
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  installListeners.add(listener);
  return () => {
    installListeners.delete(listener);
  };
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
