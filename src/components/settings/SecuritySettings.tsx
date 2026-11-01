import { useState } from 'react';
import { Check, KeyRound, Lock } from 'lucide-react';
import PasscodeSheet, { type PasscodeMode } from '@/components/settings/PasscodeSheet';
import { SectionLabel, SettingsGroup, SettingsPageShell, SettingsRow } from '@/components/settings/SettingsParts';
import type { AppLock } from '@/hooks/useAppLock';
import { AUTO_LOCK_OPTIONS, type AutoLockMinutes } from '@/lib/appLock';

export default function SecuritySettings({ appLock, onBack }: { appLock: AppLock; onBack: () => void }) {
  const [sheetMode, setSheetMode] = useState<PasscodeMode | null>(null);

  return (
    <SettingsPageShell title="Безопасность" onBack={onBack}>
      <SectionLabel>Код-пароль</SectionLabel>
      <SettingsGroup>
        {appLock.hasPasscode ? (
          <>
            <SettingsRow
              icon={KeyRound}
              label="Сменить код-пароль"
              description="Введите текущий код и задайте новый"
              onClick={() => setSheetMode('change')}
            />
            <SettingsRow
              icon={KeyRound}
              label="Выключить код-пароль"
              description="Приложение перестанет запрашивать код"
              onClick={() => setSheetMode('disable')}
            />
            <SettingsRow
              icon={Lock}
              label="Заблокировать сейчас"
              description="Закрыть приложение до ввода кода"
              onClick={appLock.lockNow}
            />
          </>
        ) : (
          <SettingsRow
            icon={KeyRound}
            label="Включить код-пароль"
            description="Приложение будет открываться только после ввода кода"
            onClick={() => setSheetMode('create')}
          />
        )}
      </SettingsGroup>

      {appLock.hasPasscode && (
        <>
          <SectionLabel>Автоблокировка</SectionLabel>
          <SettingsGroup>
            {AUTO_LOCK_OPTIONS.map((option) => {
              const selected = appLock.autoLockMinutes === option.minutes;
              return (
                <button
                  key={option.minutes}
                  type="button"
                  onClick={() => appLock.setAutoLock(option.minutes as AutoLockMinutes)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
                >
                  <span className="text-[16px] text-slate-900">{option.label}</span>
                  {selected && <Check size={20} className="shrink-0 text-brand-500" />}
                </button>
              );
            })}
          </SettingsGroup>
          <p className="px-1 pt-2 text-[13px] leading-[1.4] text-slate-500">
            Если вы не пользуетесь приложением указанное время, оно заблокируется и попросит код-пароль.
          </p>
        </>
      )}

      {sheetMode && <PasscodeSheet mode={sheetMode} appLock={appLock} onClose={() => setSheetMode(null)} />}
    </SettingsPageShell>
  );
}
