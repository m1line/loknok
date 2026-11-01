import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import Avatar from '@/components/Avatar';
import type { ActiveCall } from '@/hooks/useCallManager';
import { formatCallDuration } from '@/lib/format';
import { startRingTone, type RingtoneId } from '@/lib/ringtone';

interface CallOverlayProps {
  call: ActiveCall;
  ringtone: RingtoneId;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onAccept: () => void;
  onDecline: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
}

export default function CallOverlay(props: CallOverlayProps) {
  const { call } = props;
  const phase = call.phase;

  useEffect(() => {
    if (phase !== 'outgoing' && phase !== 'incoming') return;
    return startRingTone(phase, props.ringtone);
  }, [phase, props.ringtone]);

  if (call.phase === 'incoming') {
    return <IncomingCall {...props} />;
  }

  return <ActiveCallView {...props} />;
}

function IncomingCall({ call, onAccept, onDecline }: CallOverlayProps) {
  return (
    <div className="absolute inset-0 z-[60] flex flex-col items-center justify-between bg-slate-950 px-8 pb-12 pt-24 text-white animate-screen-in">
      <div className="flex flex-col items-center gap-4 text-center">
        <Avatar name={call.peer.name} seed={call.peer.name} size={104} />
        <div>
          <p className="text-[22px] font-semibold leading-[1.2]">{call.peer.name}</p>
          <p className="mt-1 text-[15px] text-white/70">
            {call.kind === 'video' ? 'Входящий видеозвонок' : 'Входящий звонок'}
          </p>
        </div>
      </div>
      <div className="flex w-full max-w-xs items-center justify-between">
        <CircleButton label="Отклонить звонок" tone="danger" onClick={onDecline}>
          <PhoneOff size={28} />
        </CircleButton>
        <CircleButton label="Принять звонок" tone="success" onClick={onAccept}>
          {call.kind === 'video' ? <Video size={28} /> : <Phone size={28} />}
        </CircleButton>
      </div>
    </div>
  );
}

function ActiveCallView({ call, localStream, remoteStream, onHangUp, onToggleMute, onToggleCamera }: CallOverlayProps) {
  const isVideo = call.kind === 'video';
  const showRemoteVideo = isVideo && remoteStream !== null;
  const now = useNow(call.startedAt !== null);

  const statusText =
    call.phase === 'outgoing'
      ? 'Вызов...'
      : call.phase === 'connecting'
        ? 'Соединение...'
        : call.startedAt
          ? formatCallDuration(now - call.startedAt)
          : '';

  return (
    <div className="absolute inset-0 z-[60] flex flex-col overflow-hidden bg-slate-950 text-white animate-screen-in">
      <div className="absolute inset-0">
        {showRemoteVideo ? (
          <MediaTile stream={remoteStream} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <Avatar name={call.peer.name} seed={call.peer.name} size={120} />
          </div>
        )}
        {!showRemoteVideo && remoteStream && <MediaTile stream={remoteStream} audioOnly className="hidden" />}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-1 bg-gradient-to-b from-slate-950/70 to-transparent px-6 pb-10 pt-14 text-center">
        <p className="text-[20px] font-semibold leading-[1.2]">{call.peer.name}</p>
        <p className="text-[14px] text-white/80">{statusText}</p>
      </div>

      {isVideo && localStream && !call.cameraOff && (
        <div className="absolute right-4 top-28 z-10 h-36 w-24 overflow-hidden rounded-2xl bg-slate-800 shadow-lg ring-1 ring-white/20">
          <MediaTile stream={localStream} muted mirrored className="h-full w-full object-cover" />
        </div>
      )}

      <div className="relative z-10 mt-auto flex items-center justify-center gap-6 px-6 pb-12 pt-6">
        <CircleButton
          label={call.muted ? 'Включить микрофон' : 'Выключить микрофон'}
          tone={call.muted ? 'active' : 'neutral'}
          onClick={onToggleMute}
        >
          {call.muted ? <MicOff size={24} /> : <Mic size={24} />}
        </CircleButton>
        {isVideo && (
          <CircleButton
            label={call.cameraOff ? 'Включить камеру' : 'Выключить камеру'}
            tone={call.cameraOff ? 'active' : 'neutral'}
            onClick={onToggleCamera}
          >
            {call.cameraOff ? <VideoOff size={24} /> : <Video size={24} />}
          </CircleButton>
        )}
        <CircleButton label="Завершить звонок" tone="danger" onClick={onHangUp}>
          <PhoneOff size={26} />
        </CircleButton>
      </div>
    </div>
  );
}

function MediaTile({
  stream,
  muted = false,
  mirrored = false,
  audioOnly = false,
  className,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  mirrored?: boolean;
  audioOnly?: boolean;
  className: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.srcObject = stream;
    if (stream) void element.play().catch(() => undefined);
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      aria-hidden={audioOnly}
      className={`${className} ${mirrored ? '-scale-x-100' : ''}`}
    />
  );
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

function CircleButton({
  label,
  tone,
  onClick,
  children,
}: {
  label: string;
  tone: 'neutral' | 'active' | 'danger' | 'success';
  onClick: () => void;
  children: ReactNode;
}) {
  const toneClass = {
    neutral: 'bg-white/15 text-white hover:bg-white/25',
    active: 'bg-white text-slate-900 hover:bg-white/90',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    success: 'bg-emerald-500 text-white hover:bg-emerald-600',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition active:scale-90 ${toneClass}`}
    >
      {children}
    </button>
  );
}
