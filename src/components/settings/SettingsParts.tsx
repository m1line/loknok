import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import type { MyProfile } from '@/lib/types';

export interface SettingsPageProps {
  profile: MyProfile;
  onProfileUpdated: (profile: MyProfile) => void;
  onError: (message: string) => void;
}

export function SettingsPageShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <section className="flex h-full flex-col animate-fade-in">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200/70 bg-white/85 px-3 pb-3 pt-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад"
          className="flex h-10 w-10 items-center justify-center rounded-full text-brand-600 transition hover:bg-brand-50 active:scale-90"
        >
          <ChevronLeft size={26} />
        </button>
        <h1 className="text-[22px] font-bold leading-[1.2] text-slate-900">{title}</h1>
      </header>
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-10 pt-5">{children}</div>
    </section>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="px-1 pb-2 pt-4 text-[13px] font-semibold uppercase tracking-wide text-slate-500">{children}</p>;
}

export function SettingsGroup({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
      {children}
    </div>
  );
}

export function SettingsRow({
  icon: Icon,
  label,
  description,
  value,
  onClick,
  premium = false,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  value?: string;
  onClick: () => void;
  premium?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          premium ? 'bg-amber-100 text-amber-600' : 'bg-brand-50 text-brand-600'
        }`}
      >
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] text-slate-900">{label}</span>
        {description && <span className="mt-0.5 block truncate text-[13px] text-slate-500">{description}</span>}
      </span>
      {value && <span className="max-w-[35%] truncate text-[14px] text-slate-500">{value}</span>}
      <ChevronRight size={18} className="shrink-0 text-slate-300" />
    </button>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-[16px] text-slate-900">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] leading-[1.4] text-slate-500">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-7 w-12 rounded-full bg-slate-300 transition-colors peer-checked:bg-brand-500 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-500/30 peer-disabled:opacity-50" />
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
