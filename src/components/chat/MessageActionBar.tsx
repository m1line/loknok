import { Copy, EyeOff, Pencil, Reply, Trash2, X, type LucideIcon } from 'lucide-react';
import { REACTION_EMOJIS, type ReactionEmoji } from '@/lib/reactions';

interface MessageActionBarProps {
  onReact: (emoji: ReactionEmoji) => void;
  onReply: () => void;
  onCopy?: () => void;
  onEdit?: () => void;
  onHideForMe: () => void;
  onDeleteForAll?: () => void;
  onClose: () => void;
}

export default function MessageActionBar({
  onReact,
  onReply,
  onCopy,
  onEdit,
  onHideForMe,
  onDeleteForAll,
  onClose,
}: MessageActionBarProps) {
  return (
    <div className="mb-2 flex animate-rise-in flex-col gap-2 rounded-2xl bg-white p-2 shadow-md ring-1 ring-slate-200">
      <div className="flex items-center gap-1">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact(emoji)}
            aria-label={`Реакция ${emoji}`}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[20px] transition hover:bg-slate-100 active:scale-90"
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть действия"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 active:scale-90"
        >
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <ActionButton icon={Reply} label="Ответить" onClick={onReply} />
        {onCopy && <ActionButton icon={Copy} label="Копировать" onClick={onCopy} />}
        {onEdit && <ActionButton icon={Pencil} label="Изменить" onClick={onEdit} />}
        <ActionButton icon={EyeOff} label="Удалить у меня" tone="danger" onClick={onHideForMe} />
        {onDeleteForAll && <ActionButton icon={Trash2} label="Удалить у всех" tone="danger" onClick={onDeleteForAll} />}
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  tone = 'default',
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  tone?: 'default' | 'danger';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 items-center gap-2 rounded-xl px-3 text-[14px] font-semibold transition active:scale-95 ${
        tone === 'danger' ? 'text-red-600 hover:bg-red-50' : 'text-brand-600 hover:bg-brand-50'
      }`}
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}
