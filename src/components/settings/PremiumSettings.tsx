import { Check, Crown } from 'lucide-react';
import { SettingsPageShell } from '@/components/settings/SettingsParts';
import type { Profile } from '@/lib/types';

const FEATURES = ['Настройка «Только мои контакты» в конфиденциальности'];

export default function PremiumSettings({ profile, onBack }: { profile: Profile; onBack: () => void }) {
  return (
    <SettingsPageShell title="Premium" onBack={onBack}>
      <div className="flex flex-col items-center gap-3 pb-6 text-center animate-rise-in">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-lg shadow-amber-500/30">
          <Crown size={36} />
        </div>
        <p className="text-[22px] font-bold text-slate-900">Telegram Premium</p>
        <p className="max-w-xs text-[14px] leading-[1.5] text-slate-500">
          Дополнительные возможности для вашего аккаунта.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
        <p className="pb-2 text-[13px] font-semibold uppercase tracking-wide text-slate-500">Что входит</p>
        <ul className="flex flex-col gap-2">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-[15px] text-slate-800">
              <Check size={18} className="mt-0.5 shrink-0 text-emerald-600" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        {profile.is_premium ? (
          <p className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 py-4 text-[15px] font-semibold text-emerald-700">
            <Check size={18} /> Premium активен
          </p>
        ) : (
          <>
            <button
              type="button"
              disabled
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 text-[16px] font-semibold text-white opacity-60"
            >
              Оформить Premium
            </button>
            <p className="pt-3 text-center text-[13px] leading-[1.5] text-slate-500">
              Оплата пока не подключена, поэтому оформить подписку нельзя.
            </p>
          </>
        )}
      </div>
    </SettingsPageShell>
  );
}
