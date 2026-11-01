import { SectionLabel, SettingsGroup, SettingsPageShell, ToggleRow, type SettingsPageProps } from '@/components/settings/SettingsParts';
import RingtoneChooser from '@/components/settings/RingtoneChooser';
import { usePreferencesSaver } from '@/hooks/usePreferencesSaver';
import { updateProfile } from '@/lib/profiles';
import type { ProfilePatch } from '@/lib/types';

export default function NotificationSettings({
  profile,
  onProfileUpdated,
  onError,
  onBack,
}: SettingsPageProps & { onBack: () => void }) {
  const prefs = profile.preferences;
  const savePrefs = usePreferencesSaver(profile, onProfileUpdated, onError);

  const saveProfileFlags = async (patch: ProfilePatch) => {
    try {
      onProfileUpdated({ ...profile, ...(await updateProfile(profile.id, patch)) });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Не удалось сохранить настройку.');
    }
  };

  return (
    <SettingsPageShell title="Уведомления" onBack={onBack}>
      <SectionLabel>Сообщения</SectionLabel>
      <SettingsGroup>
        <ToggleRow
          label="Уведомления о сообщениях"
          description="Присылать уведомление, когда приходит новое сообщение."
          checked={profile.notify_messages}
          onChange={(checked) => void saveProfileFlags({ notify_messages: checked })}
        />
        <ToggleRow
          label="Показывать текст сообщения"
          description="Выключите, чтобы в уведомлении было только имя отправителя."
          checked={profile.notify_previews}
          disabled={!profile.notify_messages}
          onChange={(checked) => void saveProfileFlags({ notify_previews: checked })}
        />
        <ToggleRow
          label="Счетчик непрочитанных"
          description="Показывать число новых сообщений на значке чатов."
          checked={prefs.unreadCounter}
          onChange={(checked) => void savePrefs({ ...prefs, unreadCounter: checked })}
        />
      </SettingsGroup>

      <SectionLabel>Звуки и звонки</SectionLabel>
      <SettingsGroup>
        <ToggleRow
          label="Звуки"
          description="Звук при получении нового сообщения."
          checked={prefs.sounds}
          onChange={(checked) => void savePrefs({ ...prefs, sounds: checked })}
        />
        <ToggleRow
          label="Звонки"
          description="Звонить при входящем вызове."
          checked={prefs.calls}
          onChange={(checked) => void savePrefs({ ...prefs, calls: checked })}
        />
      </SettingsGroup>

      <SectionLabel>Мелодия звонка</SectionLabel>
      <RingtoneChooser
        selected={prefs.ringtone}
        onSelect={(ringtone) => void savePrefs({ ...prefs, ringtone })}
      />
    </SettingsPageShell>
  );
}
