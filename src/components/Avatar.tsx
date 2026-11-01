import { Bot } from 'lucide-react';
import { avatarColor, initials } from '@/lib/format';

interface AvatarProps {
  name: string;
  seed: string;
  size?: number;
  isBot?: boolean;
  imageUrl?: string;
}

export default function Avatar({ name, seed, size = 48, isBot = false, imageUrl = '' }: AvatarProps) {
  return (
    <div
      className="flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold text-white shadow-sm"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${avatarColor(seed)}, ${avatarColor(seed + 'x')})`,
        fontSize: Math.round(size * 0.38),
      }}
      aria-hidden="true"
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : isBot ? (
        <Bot size={Math.round(size * 0.5)} strokeWidth={2} />
      ) : (
        initials(name)
      )}
    </div>
  );
}
