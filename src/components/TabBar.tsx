import { MessageCircle, Settings, Users, Newspaper } from 'lucide-react';

export type Tab = 'chats' | 'contacts' | 'posts' | 'settings';

const TABS: { id: Tab; label: string; icon: typeof MessageCircle }[] = [
  { id: 'chats', label: 'Чаты', icon: MessageCircle },
  { id: 'contacts', label: 'Контакты', icon: Users },
  { id: 'posts', label: 'Посты', icon: Newspaper },
  { id: 'settings', label: 'Профиль', icon: Settings },
];

interface TabBarProps { active: Tab; onChange: (tab: Tab) => void }

export default function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="z-10 flex shrink-0 border-t border-slate-200/80 bg-white/95 px-1 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.04)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = id === active;
        return (
          <button key={id} type="button" onClick={() => onChange(id)} aria-current={isActive ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1 text-[11px] font-semibold transition-all duration-200 ${isActive ? 'text-brand-500' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}>
            <span className={`flex h-8 w-12 items-center justify-center rounded-2xl transition-all ${isActive ? 'bg-brand-500/10' : ''}`}>
              <Icon size={21} strokeWidth={isActive ? 2.4 : 1.8} />
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
