import { supabase } from '@/lib/supabase';

export const DEVICE_LOGIN_TOKEN_LIFETIME_MS = 5 * 60 * 1000;
const QR_PREFIX = 'loknok-login:';
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export function buildLoginQrPayload(token: string): string {
  return `${QR_PREFIX}${token}`;
}

export function parseLoginToken(raw: string): string | null {
  const trimmed = raw.trim();
  const candidate = trimmed.startsWith(QR_PREFIX) ? trimmed.slice(QR_PREFIX.length) : trimmed;
  const token = candidate.toLowerCase();
  return TOKEN_PATTERN.test(token) ? token : null;
}

export async function createDeviceLoginToken(): Promise<string> {
  const { data, error } = await supabase.rpc('create_device_login_token');
  if (error || typeof data !== 'string' || !TOKEN_PATTERN.test(data)) {
    throw new Error('Не удалось создать код для входа');
  }
  return data;
}

export async function signInWithDeviceLoginToken(token: string): Promise<void> {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-device-login`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  const body = (await response.json().catch(() => null)) as { token_hash?: unknown; error?: unknown } | null;
  if (!response.ok || typeof body?.token_hash !== 'string') {
    throw new Error(
      body?.error === 'expired_or_used' ? 'Код устарел. Обновите QR-код на телефоне.' : 'Не удалось войти по QR-коду.'
    );
  }

  const { error } = await supabase.auth.verifyOtp({ token_hash: body.token_hash, type: 'magiclink' });
  if (error) throw new Error('Не удалось войти по QR-коду.');
}
