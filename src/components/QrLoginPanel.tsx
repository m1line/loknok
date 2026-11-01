import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Camera, Loader2, MessageCircle } from 'lucide-react';
import { parseLoginToken, signInWithDeviceLoginToken } from '@/lib/deviceLogin';

interface QrDetection {
  rawValue: string;
}

interface QrDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<QrDetection[]>;
}

type QrDetectorConstructor = new (options: { formats: string[] }) => QrDetectorLike;

const SCAN_INTERVAL_MS = 300;

function getQrDetectorConstructor(): QrDetectorConstructor | null {
  const candidate = (window as unknown as { BarcodeDetector?: QrDetectorConstructor }).BarcodeDetector;
  return candidate ?? null;
}

export default function QrLoginPanel({ onBack }: { onBack: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraState, setCameraState] = useState<'starting' | 'scanning' | 'unavailable'>('starting');
  const [manualCode, setManualCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitToken = async (raw: string) => {
    const token = parseLoginToken(raw);
    if (!token) {
      setError('Это не код входа Сигнала. Попробуйте еще раз.');
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithDeviceLoginToken(token);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось войти по QR-коду.');
      setBusy(false);
      return false;
    }
  };

  useEffect(() => {
    const Detector = getQrDetectorConstructor();
    const video = videoRef.current;
    if (!Detector || !video || !navigator.mediaDevices?.getUserMedia) {
      setCameraState('unavailable');
      return;
    }

    let active = true;
    let timer: number | undefined;
    let stream: MediaStream | null = null;
    const detector = new Detector({ formats: ['qr_code'] });

    const scanFrame = async () => {
      if (!active) return;
      try {
        const codes = await detector.detect(video);
        const raw = codes[0]?.rawValue;
        if (raw && parseLoginToken(raw)) {
          active = false;
          const ok = await submitToken(raw);
          if (!ok) {
            active = true;
            timer = window.setTimeout(() => void scanFrame(), SCAN_INTERVAL_MS);
          }
          return;
        }
      } catch {
        // A single unreadable frame is expected; keep scanning.
      }
      timer = window.setTimeout(() => void scanFrame(), SCAN_INTERVAL_MS);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(async (media) => {
        if (!active) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        video.srcObject = media;
        await video.play();
        setCameraState('scanning');
        timer = window.setTimeout(() => void scanFrame(), SCAN_INTERVAL_MS);
      })
      .catch(() => {
        if (active) setCameraState('unavailable');
      });

    return () => {
      active = false;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // Scanning starts once on mount; submitToken only reads stable state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !manualCode.trim()) return;
    await submitToken(manualCode);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gradient-to-b from-brand-50 via-white to-white px-6 pb-10 pt-6">
      <button
        type="button"
        onClick={onBack}
        aria-label="Назад"
        className="flex h-10 w-10 items-center justify-center rounded-full text-brand-600 transition hover:bg-brand-50 active:scale-90"
      >
        <ArrowLeft size={24} />
      </button>

      <div className="mt-4 flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-brand-500 text-white shadow-lg shadow-brand-500/30">
          <MessageCircle size={32} strokeWidth={2} />
        </div>
        <h1 className="mt-5 text-[24px] font-bold leading-[1.2] text-slate-900">Вход по QR-коду</h1>
        <p className="mt-2 text-[15px] leading-[1.5] text-slate-500">
          Откройте Сигнал на телефоне, зайдите в Настройки, Безопасность, Устройства и нажмите «Подключить устройство».
        </p>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <div className="relative aspect-square w-full max-w-[300px] overflow-hidden rounded-3xl bg-slate-900 shadow-lg">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          {cameraState === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center text-white/70">
              <Loader2 className="animate-spin" size={28} />
            </div>
          )}
          {cameraState === 'scanning' && (
            <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]" />
          )}
          {cameraState === 'unavailable' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white/80">
              <Camera size={28} />
              <p className="text-[14px] leading-[1.5]">Камера недоступна в этом браузере. Введите код ниже.</p>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="w-full max-w-[300px] rounded-xl bg-red-50 px-4 py-3 text-center text-[14px] leading-[1.5] text-red-700">
            {error}
          </p>
        )}
        {busy && (
          <p className="flex items-center gap-2 text-[14px] text-slate-600">
            <Loader2 className="animate-spin" size={16} />
            Входим...
          </p>
        )}
      </div>

      <form onSubmit={handleManualSubmit} className="mt-8 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-slate-600">Или вставьте код с экрана телефона</span>
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Код для входа"
            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-[16px] text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !manualCode.trim()}
          className="flex h-12 items-center justify-center rounded-xl bg-brand-500 text-[16px] font-semibold text-white shadow-md shadow-brand-500/25 transition hover:bg-brand-600 active:scale-[0.98] disabled:opacity-60"
        >
          Войти
        </button>
      </form>
    </div>
  );
}
