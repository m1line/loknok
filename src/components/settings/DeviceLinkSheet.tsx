import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Loader2, RefreshCw, X } from 'lucide-react';
import {
  buildLoginQrPayload,
  createDeviceLoginToken,
  DEVICE_LOGIN_TOKEN_LIFETIME_MS,
} from '@/lib/deviceLogin';

interface DeviceLinkSheetProps {
  onClose: () => void;
}

interface LoginQr {
  dataUrl: string;
  expiresAt: number;
}

export default function DeviceLinkSheet({ onClose }: DeviceLinkSheetProps) {
  const [qr, setQr] = useState<LoginQr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let refreshTimer: number | undefined;

    const refresh = async () => {
      try {
        const token = await createDeviceLoginToken();
        const dataUrl = await QRCode.toDataURL(buildLoginQrPayload(token), {
          width: 240,
          margin: 1,
          errorCorrectionLevel: 'M',
        });
        if (!active) return;
        setError(null);
        setQr({ dataUrl, expiresAt: Date.now() + DEVICE_LOGIN_TOKEN_LIFETIME_MS });
        refreshTimer = window.setTimeout(() => void refresh(), DEVICE_LOGIN_TOKEN_LIFETIME_MS);
      } catch {
        if (active) setError('Не удалось создать QR-код. Попробуйте еще раз.');
      }
    };

    void refresh();
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
      window.clearInterval(clock);
    };
  }, [attempt]);

  const secondsLeft = qr ? Math.max(0, Math.ceil((qr.expiresAt - now) / 1000)) : 0;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="absolute inset-0 z-40 flex items-end bg-slate-900/40 animate-fade-in" role="dialog" aria-modal="true">
      <div className="flex w-full flex-col items-center gap-4 rounded-t-3xl bg-white px-6 pb-8 pt-4 shadow-2xl animate-sheet-up">
        <div className="flex w-full items-center justify-between">
          <h2 className="text-[18px] font-bold text-slate-900">Подключить устройство</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 active:scale-90"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-center text-[14px] leading-[1.5] text-slate-600">
          На компьютере откройте Сигнал, выберите «Войти по QR-коду» и наведите камеру на этот код.
        </p>

        <div className="flex h-[272px] w-[272px] items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200">
          {qr ? (
            <img src={qr.dataUrl} alt="QR-код для входа на компьютер" className="h-[240px] w-[240px]" />
          ) : error ? (
            <p role="alert" className="px-4 text-center text-[14px] text-red-600">
              {error}
            </p>
          ) : (
            <Loader2 className="animate-spin text-slate-400" size={28} />
          )}
        </div>

        {qr && (
          <p className="text-[13px] text-slate-500">
            Код обновится через {minutes}:{seconds}
          </p>
        )}

        {error && (
          <button
            type="button"
            onClick={() => {
              setQr(null);
              setError(null);
              setAttempt((count) => count + 1);
            }}
            className="flex h-10 items-center gap-2 rounded-full bg-brand-50 px-4 text-[14px] font-semibold text-brand-700 transition active:scale-95"
          >
            <RefreshCw size={16} />
            Попробовать снова
          </button>
        )}
      </div>
    </div>
  );
}
