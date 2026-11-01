import { useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { Reply } from 'lucide-react';

const TRIGGER_PX = 56;
const MAX_PX = 80;
const LOCK_PX = 8;

interface SwipeToReplyProps {
  onReply: () => void;
  children: ReactNode;
}

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  horizontal: boolean;
}

export default function SwipeToReply({ onReply, children }: SwipeToReplyProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const distance = useRef(0);
  const swiped = useRef(false);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) return;
    gesture.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, horizontal: false };
    swiped.current = false;
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;

    if (!current.horizontal) {
      if (Math.abs(dy) > LOCK_PX && Math.abs(dy) > Math.abs(dx)) {
        gesture.current = null;
        return;
      }
      if (dx < LOCK_PX) return;
      current.horizontal = true;
      swiped.current = true;
      setDragging(true);
    }

    distance.current = Math.min(MAX_PX, Math.max(0, dx - LOCK_PX));
    setOffset(distance.current);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointerId) return;
    const shouldReply = current.horizontal && distance.current >= TRIGGER_PX;
    gesture.current = null;
    distance.current = 0;
    setDragging(false);
    setOffset(0);
    if (shouldReply) onReply();
  };

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!swiped.current) return;
    swiped.current = false;
    event.stopPropagation();
    event.preventDefault();
  };

  const progress = Math.min(1, offset / TRIGGER_PX);

  return (
    <div
      className="relative touch-pan-y"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onClickCapture={handleClickCapture}
    >
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1 flex items-center" style={{ opacity: progress }}>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand-500 shadow-sm ring-1 ring-slate-200 transition-transform ${
            progress >= 1 ? 'scale-110' : ''
          }`}
        >
          <Reply size={16} />
        </span>
      </div>
      <div style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform 200ms ease-out' }}>
        {children}
      </div>
    </div>
  );
}
