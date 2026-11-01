import { useState } from 'react';
import { Check, Crown, Fingerprint, KeyRound, Smartphone } from 'lucide-react';
import {
  SectionLabel,
  SettingsGroup,
  SettingsPageShell,
  SettingsRow,
  type SettingsPageProps,
} from '@/components/settings/SettingsParts';
import { updateProfile } from '@/lib/profiles';
import AutoDeleteSection from '@/components/settings/AutoDeleteSection';
import type { LastSeenVisibility } from '@/lib/preferences';
import type { MyProfile, WhoCanMessage } from '@/lib/types';

type ChoiceOption<T extends string> = { value: T; label: string; description: string; premium?: boolean };

const WHO_CAN_MESSAGE: ChoiceOption<WhoCanMessage>[] = [
  { value: 'everyone', label: 'Все', description: 'Любой пользователь может написать вам первым.' },
  {
    value: 'contacts',
    label: 'Только мои контакты',
    description: 'Писать смогут только те, кого вы добавили в контакты.',
    premium: true,
  },
];

const LAST_SEEN: ChoiceOption<LastSeenVisibility>[] = [
  { value: 'everyone', label: 'Все', description: 'Видно всем пользователям.' },
  { value: 'contacts', label: 'Мои контакты', description: 'Видно только вашим контактам.' },
  { value: 'nobody', label: 'Никто', description: 'Время вашего захода скрыто от всех.' },
];

export default function PrivacySettings({
  profile,
  onProfileUpdated,
  onError,
  onBack,
  onOpenPremium,
  onOpenSection,
}: SettingsPageProps & {
  onBack: () => void;
  onOpenPremium: () => void;
  onOpenSection: (page: 'security' | 'devices' | 'passkeys') => void;
}) {
  const [saving, setSaving] = useState(false);

  const save = async (patch: Partial<Pick<MyProfile, 'who_can_message' | 'last_seen_visibility'>>) => {
    setSaving(true);
    try {
      onProfileUpdated({ ...profile, ...(await updateProfile(profile.id, patch)) });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Не удалось сохранить настройку.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsPageShell title="Конфиденциальность" onBack={onBack}>
      <SectionLabel>Кто может писать мне</SectionLabel>
      <SettingsGroup>
        {WHO_CAN_MESSAGE.map((option) => {
          const selected = profile.who_can_message === option.value;
          const locked = option.premium && !profile.is_premium;
          return (
            <ChoiceRow
              key={option.value}
              option={option}
              selected={selected}
              locked={!!locked}
              disabled={saving}
              onSelect={() => {
                if (selected) return;
                if (locked) {
                  onOpenPremium();
                  return;
                }
                void save({ who_can_message: option.value });
              }}
            />
          );
        })}
      </SettingsGroup>

      <SectionLabel>Время захода</SectionLabel>
      <SettingsGroup>
        {LAST_SEEN.map((option) => (
          <ChoiceRow
            key={option.value}
            option={option}
            selected={profile.last_seen_visibility === option.value}
            locked={false}
            disabled={saving}
            onSelect={() => {
              if (profile.last_seen_visibility !== option.value) void save({ last_seen_visibility: option.value });
            }}
          />
        ))}
      </SettingsGroup>

      <AutoDeleteSection profile={profile} onProfileUpdated={onProfileUpdated} onError={onError} />

      <SectionLabel>Безопасность</SectionLabel>
      <SettingsGroup>
        <SettingsRow
          icon={KeyRound}
          label="Код-пароль и блокировка"
          description="Защита приложения и автоблокировка"
          onClick={() => onOpenSection('security')}
        />
        <SettingsRow
          icon={Smartphone}
          label="Устройства"
          description="Где вы вошли в аккаунт"
          onClick={() => onOpenSection('devices')}
        />
        <SettingsRow
          icon={Fingerprint}
          label="Ключи доступа"
          description="Вход без пароля с помощью устройства"
          onClick={() => onOpenSection('passkeys')}
        />
      </SettingsGroup>
    </SettingsPageShell>
  );
}

function ChoiceRow<T extends string>({
  option,
  selected,
  locked,
  disabled,
  onSelect,
}: {
  option: ChoiceOption<T>;
  selected: boolean;
  locked: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[16px] text-slate-900">
          {option.label}
          {locked && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              <Crown size={11} /> Premium
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[13px] leading-[1.4] text-slate-500">{option.description}</span>
      </span>
      {selected && <Check size={20} className="shrink-0 text-brand-500" />}
    </button>
  );
}
