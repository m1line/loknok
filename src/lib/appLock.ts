export const PASSCODE_LENGTH = 4;

export const AUTO_LOCK_OPTIONS = [
  { minutes: 0, label: 'Никогда' },
  { minutes: 1, label: 'Через 1 минуту' },
  { minutes: 5, label: 'Через 5 минут' },
  { minutes: 60, label: 'Через 1 час' },
] as const;

export type AutoLockMinutes = (typeof AUTO_LOCK_OPTIONS)[number]['minutes'];

export interface AppLockSettings {
  passcodeHash: string | null;
  salt: string | null;
  autoLockMinutes: AutoLockMinutes;
}

export interface PasscodeRecord {
  passcodeHash: string;
  salt: string;
}

const STORAGE_KEY = 'loknok.appLock';
const PBKDF2_ITERATIONS = 210_000;
const DEFAULT_AUTO_LOCK: AutoLockMinutes = 5;

const DEFAULT_APP_LOCK: AppLockSettings = { passcodeHash: null, salt: null, autoLockMinutes: DEFAULT_AUTO_LOCK };

export function isValidPasscode(value: string): boolean {
  return new RegExp(`^\\d{${PASSCODE_LENGTH}}$`).test(value);
}

export function loadAppLockSettings(): AppLockSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_LOCK;
    const value = JSON.parse(raw) as Partial<AppLockSettings>;
    const autoLockMinutes = AUTO_LOCK_OPTIONS.find((option) => option.minutes === value.autoLockMinutes)?.minutes ?? DEFAULT_AUTO_LOCK;
    if (typeof value.passcodeHash !== 'string' || typeof value.salt !== 'string') {
      return { passcodeHash: null, salt: null, autoLockMinutes };
    }
    return { passcodeHash: value.passcodeHash, salt: value.salt, autoLockMinutes };
  } catch {
    return DEFAULT_APP_LOCK;
  }
}

export function saveAppLockSettings(settings: AppLockSettings): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function deriveHash(passcode: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(passcode), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

export async function createPasscodeRecord(passcode: string): Promise<PasscodeRecord> {
  const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
  return { passcodeHash: await deriveHash(passcode, salt), salt };
}

export async function checkPasscode(passcode: string, record: PasscodeRecord): Promise<boolean> {
  return (await deriveHash(passcode, record.salt)) === record.passcodeHash;
}
