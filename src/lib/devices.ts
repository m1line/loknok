import { supabase } from '@/lib/supabase';

export type DevicePlatform = 'android' | 'iphone' | 'web';

export interface DeviceRow {
  id: string;
  device_token: string;
  name: string;
  platform: DevicePlatform;
  city: string;
  last_active_at: string;
  created_at: string;
}

export interface DeviceInfo {
  name: string;
  platform: DevicePlatform;
  city: string;
}

const DEVICE_COLUMNS = 'id, device_token, name, platform, city, last_active_at, created_at';
const TOKEN_KEY = 'loknok.deviceToken';
const REGISTERED_KEY = 'loknok.deviceRegistered';
export const ONLINE_WINDOW_MS = 2 * 60_000;

export function getDeviceToken(): string {
  let token = window.localStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    window.localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

export function describeThisDevice(): DeviceInfo {
  const ua = navigator.userAgent;
  const city = (Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop() ?? '').replace(/_/g, ' ');
  if (/iPhone|iPad|iPod/.test(ua)) {
    return { name: /iPad/.test(ua) ? 'iPad' : 'iPhone', platform: 'iphone', city };
  }
  if (/Android/.test(ua)) {
    const model = ua.match(/Android[^;]*;\s*([^;)]+)\)/)?.[1]?.replace(/\s*Build\/.*$/, '').trim();
    return { name: model || 'Android', platform: 'android', city };
  }
  if (/Macintosh/.test(ua)) return { name: 'Mac', platform: 'web', city };
  if (/Windows/.test(ua)) return { name: 'Windows PC', platform: 'web', city };
  return { name: 'Компьютер', platform: 'web', city };
}

export function appLabel(platform: DevicePlatform): string {
  if (platform === 'android') return 'Android';
  if (platform === 'iphone') return 'iPhone';
  return 'Web';
}

export function describeActivity(lastActiveAt: string, now: number): { online: boolean; text: string } {
  const elapsed = now - new Date(lastActiveAt).getTime();
  if (elapsed < ONLINE_WINDOW_MS) return { online: true, text: 'в сети' };
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return { online: false, text: `был(а) ${minutes} мин назад` };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { online: false, text: `был(а) ${hours} ч назад` };
  return { online: false, text: `был(а) ${Math.floor(hours / 24)} дн назад` };
}

export async function touchDevice(profileId: string): Promise<'ok' | 'revoked'> {
  const token = getDeviceToken();
  const info = describeThisDevice();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('devices')
    .update({ last_active_at: now, name: info.name, platform: info.platform, city: info.city })
    .eq('profile_id', profileId)
    .eq('device_token', token)
    .select('id');
  if (error) throw new Error(error.message);
  if (Array.isArray(data) && data.length > 0) return 'ok';

  if (window.localStorage.getItem(REGISTERED_KEY) === token) {
    window.localStorage.removeItem(REGISTERED_KEY);
    return 'revoked';
  }

  const { error: insertError } = await supabase.from('devices').insert({
    profile_id: profileId,
    device_token: token,
    name: info.name,
    platform: info.platform,
    city: info.city,
    last_active_at: now,
  });
  if (insertError) throw new Error(insertError.message);
  window.localStorage.setItem(REGISTERED_KEY, token);
  return 'ok';
}

export async function fetchDevices(profileId: string): Promise<DeviceRow[]> {
  const { data, error } = await supabase
    .from('devices')
    .select(DEVICE_COLUMNS)
    .eq('profile_id', profileId)
    .order('last_active_at', { ascending: false });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error('Не удалось загрузить список устройств.');
  return data as DeviceRow[];
}

export async function removeDevice(profileId: string, deviceId: string): Promise<void> {
  const { error } = await supabase.from('devices').delete().eq('profile_id', profileId).eq('id', deviceId);
  if (error) throw new Error(error.message);
}

export async function removeOtherDevices(profileId: string): Promise<void> {
  const { error } = await supabase
    .from('devices')
    .delete()
    .eq('profile_id', profileId)
    .neq('device_token', getDeviceToken());
  if (error) throw new Error(error.message);
}

export async function removeInactiveDevices(profileId: string, days: number): Promise<void> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { error } = await supabase
    .from('devices')
    .delete()
    .eq('profile_id', profileId)
    .neq('device_token', getDeviceToken())
    .lt('last_active_at', cutoff);
  if (error) throw new Error(error.message);
}
