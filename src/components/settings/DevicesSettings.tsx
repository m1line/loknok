import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Monitor, Smartphone, X } from 'lucide-react';
import { SectionLabel, SettingsGroup, SettingsPageShell, type SettingsPageProps } from '@/components/settings/SettingsParts';
import DeviceLinkSheet from '@/components/settings/DeviceLinkSheet';
import { usePreferencesSaver } from '@/hooks/usePreferencesSaver';
import {
  appLabel,
  describeActivity,
  describeThisDevice,
  fetchDevices,
  getDeviceToken,
  removeDevice,
  removeOtherDevices,
  type DeviceInfo,
  type DeviceRow,
} from '@/lib/devices';
import { INACTIVE_SESSION_OPTIONS } from '@/lib/preferences';

const SESSION_LABELS: Record<(typeof INACTIVE_SESSION_OPTIONS)[number], string> = {
  1: '1 день',
  7: '1 неделя',
  30: '1 месяц',
  365: '1 год',
};

const REFRESH_MS = 60_000;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Не удалось выполнить действие.';
}

export default function DevicesSettings({
  profile,
  onProfileUpdated,
  onError,
  onBack,
}: SettingsPageProps & { onBack: () => void }) {
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [linking, setLinking] = useState(false);
  const save = usePreferencesSaver(profile, onProfileUpdated, onError);
  const prefs = profile.preferences;
  const thisToken = getDeviceToken();
  const thisDevice: DeviceInfo = describeThisDevice();

  const load = useCallback(async () => {
    try {
      setDevices(await fetchDevices(profile.id));
    } catch (err) {
      onError(errorMessage(err));
    }
  }, [profile.id, onError]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const otherDevices = devices?.filter((device) => device.device_token !== thisToken) ?? [];

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative h-full">
    <SettingsPageShell title="Устройства" onBack={onBack}>
      <button
        type="button"
        onClick={() => setLinking(true)}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 text-[16px] font-semibold text-white shadow-md shadow-brand-500/25 transition hover:bg-brand-600 active:scale-[0.98]"
      >
        <Smartphone size={18} />
        Подключить устройство
      </button>

      <SectionLabel>Это устройство</SectionLabel>
      <SettingsGroup>
        <div className="flex items-center gap-3 px-4 py-3">
          <DeviceIcon platform={thisDevice.platform} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold text-slate-900">{thisDevice.name}</p>
            <p className="truncate text-[13px] text-slate-500">Loknok {appLabel(thisDevice.platform)} 1.1</p>
            <p className="truncate text-[13px] text-slate-500">
              {thisDevice.city && `${thisDevice.city} · `}
              <span className="text-emerald-600">в сети</span>
            </p>
          </div>
        </div>
      </SettingsGroup>
      <button
        type="button"
        onClick={() => void runAction(() => removeOtherDevices(profile.id))}
        disabled={busy || otherDevices.length === 0}
        className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl bg-white text-[16px] font-semibold text-red-600 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
      >
        Завершить все сеансы
      </button>

      <SectionLabel>Активные сеансы</SectionLabel>
      {devices === null ? (
        <div className="flex justify-center py-6 text-slate-500">
          <Loader2 className="animate-spin" size={22} />
        </div>
      ) : (
        <SettingsGroup>
          {otherDevices.length === 0 && (
            <p className="px-4 py-4 text-[14px] text-slate-500">Других активных сеансов нет.</p>
          )}
          {otherDevices.map((device) => {
            const activity = describeActivity(device.last_active_at, Date.now());
            return (
              <div key={device.id} className="flex items-center gap-3 px-4 py-3">
                <DeviceIcon platform={device.platform} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] text-slate-900">{device.name}</p>
                  <p className="truncate text-[13px] text-slate-500">Loknok {appLabel(device.platform)} 1.1</p>
                  <p className="truncate text-[13px] text-slate-500">
                    {device.city && `${device.city} · `}
                    <span className={activity.online ? 'text-emerald-600' : ''}>{activity.text}</span>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runAction(() => removeDevice(profile.id, device.id))}
                  aria-label="Завершить сеанс"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-red-600 transition hover:bg-red-50 active:scale-90 disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>
            );
          })}
        </SettingsGroup>
      )}

      <SectionLabel>Автоматически завершать сеансы</SectionLabel>
      <SettingsGroup>
        {INACTIVE_SESSION_OPTIONS.map((days) => {
          const selected = prefs.inactiveSessionDays === days;
          return (
            <button
              key={days}
              type="button"
              onClick={() => {
                if (!selected) void save({ ...prefs, inactiveSessionDays: days });
              }}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
            >
              <span className="text-[16px] text-slate-900">{SESSION_LABELS[days]}</span>
              {selected && <Check size={20} className="shrink-0 text-brand-500" />}
            </button>
          );
        })}
      </SettingsGroup>
      <p className="px-1 pt-2 text-[13px] leading-[1.4] text-slate-500">
        Сеансы, которыми не пользовались дольше выбранного срока, завершаются автоматически.
      </p>
    </SettingsPageShell>
      {linking && <DeviceLinkSheet onClose={() => setLinking(false)} />}
    </div>
  );
}

function DeviceIcon({ platform }: { platform: DeviceInfo['platform'] }) {
  const Icon = platform === 'web' ? Monitor : Smartphone;
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
      <Icon size={20} />
    </span>
  );
}
