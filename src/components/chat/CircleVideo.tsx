import { Pause, Play } from 'lucide-react';
import { useRef, useState } from 'react';

interface CircleVideoProps {
  src: string;
}

export default function CircleVideo({ src }: CircleVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  };

  return (
    <button
      type="button"
      onClick={togglePlayback}
      aria-label={playing ? 'Пауза' : 'Воспроизвести кружок'}
      className="group relative h-44 w-44 shrink-0 overflow-hidden rounded-full bg-slate-900 shadow-md ring-4 ring-white/80 transition active:scale-95"
    >
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="h-full w-full object-cover"
      />
      <span
        className={`absolute inset-0 flex items-center justify-center bg-slate-900/25 transition duration-200 ${
          playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
        }`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow">
          {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
        </span>
      </span>
    </button>
  );
}
