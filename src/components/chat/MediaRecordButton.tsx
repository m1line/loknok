import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Mic, Video } from 'lucide-react';
import { useMediaRecorder, type RecordedMedia } from '@/hooks/useMediaRecorder';
import type { MediaKind } from '@/lib/types';

const TAP_MAX_MS = 350;
const MAX_RECORD_MS = 60_000;

interface MediaRecordButtonProps {
  mode: MediaKind;
  onModeChange: (mode: MediaKind) => void;
  onRecorded: (media: RecordedMedia) => void;
  onError: (message: string) => void;
}

export default function MediaRecordButton({ mode, onModeChange, onRecorded, onError }: MediaRecordButtonProps) {
  const recorder = useMediaRecorder();
  const { previewStream, recording } = recorder;
  const pressingRef = useRef(false);
  const startedRef = useRef(false);
  const pressStartRef = useRef(0);
  const maxTimerRef = useRef<number | undefined>(undefined);
  const previewRef = useRef<HTMLVideoElement>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = previewStream;
  }, [previewStream]);

  useEffect(() => {
    if (!recording) {
      setSeconds(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  const switchMode = async (next: MediaKind) => {
    onModeChange(next);
    if (next === 'circle') {
      try {
        await recorder.openCamera();
      } catch {
        onError('Нет доступа к камере. Разрешите доступ в браузере.');
        onModeChange('voice');
      }
    } else {
      recorder.closeCamera();
    }
  };

  const sendRecording = async () => {
    const media = await recorder.finish();
    if (media) onRecorded(media);
  };

  const release = async () => {
    pressingRef.current = false;
    startedRef.current = false;
    window.clearTimeout(maxTimerRef.current);
    if (Date.now() - pressStartRef.current < TAP_MAX_MS) {
      recorder.cancel();
      await switchMode(mode === 'voice' ? 'circle' : 'voice');
      return;
    }
    await sendRecording();
  };

  const handlePointerDown = async (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pressingRef.current = true;
    pressStartRef.current = Date.now();
    const failure = await recorder.start(mode);
    if (failure) {
      pressingRef.current = false;
      onError(failure);
      return;
    }
    startedRef.current = true;
    maxTimerRef.current = window.setTimeout(() => {
      if (!startedRef.current) return;
      pressingRef.current = false;
      startedRef.current = false;
      void sendRecording();
    }, MAX_RECORD_MS);
    if (!pressingRef.current) await release();
  };

  const handlePointerUp = () => {
    if (!startedRef.current) {
      pressingRef.current = false;
      return;
    }
    void release();
  };

  const Icon = mode === 'circle' ? Video : Mic;
  const minutes = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, '0');

  return (
    <>
      {mode === 'circle' && previewStream && (
        <div className="pointer-events-none absolute bottom-full right-3 mb-3 animate-rise-in">
          <video
            ref={previewRef}
            autoPlay
            muted
            playsInline
            className={`h-40 w-40 rounded-full object-cover shadow-xl ring-4 -scale-x-100 ${
              recording ? 'ring-red-500' : 'ring-white'
            }`}
          />
        </div>
      )}
      {recording && (
        <div className="pointer-events-none absolute bottom-full left-0 right-0 mb-3 flex justify-center">
          <span className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-800 shadow-md">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            {minutes}:{secs}
          </span>
        </div>
      )}
      <button
        type="button"
        onPointerDown={(event) => void handlePointerDown(event)}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(event) => event.preventDefault()}
        aria-label={mode === 'circle' ? 'Записать видеокружок' : 'Записать голосовое'}
        className={`flex h-10 w-10 shrink-0 touch-none select-none items-center justify-center rounded-full transition-all duration-200 active:scale-90 ${
          recording ? 'scale-110 bg-red-500 text-white shadow-lg shadow-red-500/40' : 'text-brand-500 hover:bg-brand-50'
        }`}
      >
        <Icon size={22} />
      </button>
    </>
  );
}
