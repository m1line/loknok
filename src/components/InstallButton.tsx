import { useState } from 'react';
import { Download, Share, Smartphone } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { isIos } from '@/lib/pwa';

export default function InstallButton() {
  const { standalone, deferred, clearDeferred } = useInstallPrompt();
  const [showIosHint, setShowIosHint] = useState(false);
  const [installing, setInstalling] = useState(false);
  const iosDevice = isIos();

  if (standalone || (!deferred && !iosDevice)) return null;

  const handleInstall = async () => {
    if (!deferred) {
      setShowIosHint((value) => !value);
      return;
    }
    setInstalling(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } finally {
      clearDeferred();
      setInstalling(false);
    }
  };

  return (
    <div className="mb-5 animate-rise-in overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Smartphone size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-slate-900">Установить приложение</p>
          <p className="text-[13px] text-slate-500">Быстрый запуск прямо с экрана телефона</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleInstall()}
        disabled={installing}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-[15px] font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
      >
        <Download size={18} />
        Скачать приложение
      </button>

      {showIosHint && !deferred && (
        <div className="mt-3 flex gap-3 rounded-xl bg-slate-50 p-3 text-[13px] leading-[1.5] text-slate-600 animate-fade-in">
          <Share size={18} className="mt-0.5 shrink-0 text-brand-600" />
          <p>
            Нажмите «Поделиться» в нижней панели Safari и выберите «На экран «Домой»».
          </p>
        </div>
      )}
    </div>
  );
}
