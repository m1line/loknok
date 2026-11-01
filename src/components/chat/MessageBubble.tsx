import { bubbleStyle, type BubbleColorId } from '@/lib/preferences';

export interface BubbleQuote {
  author: string;
  text: string;
}

export interface BubbleLook {
  textSize: number;
  bubbleColor: BubbleColorId;
  nightMode: boolean;
  animate: boolean;
}

interface MessageBubbleProps extends BubbleLook {
  text: string;
  time: string;
  mine: boolean;
  quote?: BubbleQuote | null;
  onClick?: () => void;
}

export default function MessageBubble({
  text,
  time,
  mine,
  quote = null,
  onClick,
  textSize,
  bubbleColor,
  nightMode,
  animate,
}: MessageBubbleProps) {
  const style = bubbleStyle(bubbleColor, mine, nightMode);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{ ...style, fontSize: textSize, lineHeight: 1.45 }}
      className={`max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3 pb-1.5 pt-2 text-left shadow-sm transition enabled:active:scale-[0.99] disabled:cursor-default ${
        mine ? 'rounded-br-md' : 'rounded-bl-md'
      } ${animate ? 'animate-rise-in' : ''}`}
    >
      {quote && (
        <span className="mb-1 block rounded-lg border-l-2 border-current bg-black/5 px-2 py-1" style={{ fontSize: '0.8em' }}>
          <span className="block truncate font-semibold">{quote.author}</span>
          <span className="block truncate opacity-80">{quote.text}</span>
        </span>
      )}
      <span className="block">{text}</span>
      <span className="mt-0.5 block text-right text-[11px] leading-none opacity-60">{time}</span>
    </button>
  );
}
