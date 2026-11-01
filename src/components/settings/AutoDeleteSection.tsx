import { useState } from 'react';
import { Check, Timer } from 'lucide-react';
import { SectionLabel, SettingsGroup, type SettingsPageProps } from '@/components/settings/SettingsParts';
import { usePreferencesSaver } from '@/hooks/usePreferencesSaver';

const PRESETS: { days: number | null; label: string }[] = [
  { days: null, label: 'Выключено' },
  { days: 1, label: '1 день' },
  { days: 7, label: '1 неделя' },
  { days: 30, label: '1 месяц' },
];

const MAX_DAYS = 3650;

export default function AutoDeleteSection({ profile, onProfileUpdated, onError }: SettingsPageProps) {
  const save = usePreferencesSaver(profile, onProfileUpdated, onError);
  const prefs = profile.preferences;
  const isCustom = prefs.autoDeleteDays !== null && !PRESETS.some((preset) => preset.days === prefs.autoDeleteDays);
  const [customDraft, setCustomDraft] = useState(isCustom ? String(prefs.autoDeleteDays) : '');
  const [customError, setCustomError] = useState<string | null>(null);

  const applyCustom = () => {
    const days = Number(customDraft);
    if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
      setCustomError(`Введите число от 1 до ${MAX_DAYS}.`);
      return;
    }
    setCustomError(null);
    void save({ ...prefs, autoDeleteDays: days });
  };

  return (
    <>
      <SectionLabel>Автоудаление сообщений</SectionLabel>
      <SettingsGroup>
        {PRESETS.map((preset) => {
          const selected = prefs.autoDeleteDays === preset.days;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                if (!selected) void save({ ...prefs, autoDeleteDays: preset.days });
              }}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
            >
              <span className="flex items-center gap-3 text-[16px] text-slate-900">
                <Timer size={18} className="text-brand-600" />
                {preset.label}
              </span>
              {selected && <Check size={20} className="shrink-0 text-brand-500" />}
            </button>
          );
        })}
        <div className="flex flex-col gap-2 px-4 py-3">
          <span className="text-[16px] text-slate-900">Свой срок, дней</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_DAYS}
              value={customDraft}
              onChange={(event) => {
                setCustomDraft(event.target.value);
                setCustomError(null);
              }}
              placeholder="Например, 14"
              className="h-10 min-w-0 flex-1 rounded-xl bg-slate-100 px-3 text-[16px] text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-500/20"
            />
            <button
              type="button"
              onClick={applyCustom}
              className="h-10 shrink-0 rounded-xl bg-brand-500 px-4 text-[14px] font-semibold text-white transition hover:bg-brand-600 active:scale-95"
            >
              Применить
            </button>
          </div>
          {customError && <span className="text-[13px] text-red-600">{customError}</span>}
        </div>
      </SettingsGroup>
      <p className="px-1 pt-2 text-[13px] leading-[1.4] text-slate-500">
        Ваши сообщения старше выбранного срока удаляются автоматически. У собеседника могут остаться его копии.
      </p>
    </>
  );
}
