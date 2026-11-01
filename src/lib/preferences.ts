import type { CSSProperties } from 'react';
import { REACTION_EMOJIS, type ReactionEmoji } from '@/lib/reactions';
import { RINGTONE_OPTIONS, type RingtoneId } from '@/lib/ringtone';

export const TEXT_SIZE_MIN = 12;
export const TEXT_SIZE_MAX = 30;

export const INACTIVE_SESSION_OPTIONS = [1, 7, 30, 365] as const;

export const BUBBLE_COLORS = [
  { id: 'sky', label: 'Небесный', background: '#cfe6ff', text: '#0f172a' },
  { id: 'mint', label: 'Мятный', background: '#cdf5df', text: '#0f172a' },
  { id: 'sand', label: 'Песочный', background: '#f8e3b5', text: '#1c1917' },
  { id: 'rose', label: 'Розовый', background: '#ffd3df', text: '#1f1720' },
  { id: 'graphite', label: 'Графит', background: '#334155', text: '#f8fafc' },
  { id: 'ocean', label: 'Океан', background: '#0f766e', text: '#f0fdfa' },
] as const;

export type BubbleColorId = (typeof BUBBLE_COLORS)[number]['id'];

export const WALLPAPER_PRESETS = [
  { id: 'sky', label: 'Небо', background: 'linear-gradient(160deg, #dfe8f1, #c7d9ea)' },
  { id: 'dawn', label: 'Рассвет', background: 'linear-gradient(160deg, #fde7d4, #f6c6c0)' },
  { id: 'meadow', label: 'Луг', background: 'linear-gradient(160deg, #dcf2e1, #b9dfc6)' },
  { id: 'paper', label: 'Бумага', background: 'linear-gradient(160deg, #f7f3ea, #ebe3d2)' },
  { id: 'night', label: 'Ночь', background: 'linear-gradient(160deg, #1e293b, #0f172a)' },
] as const;

export const SOLID_WALLPAPER_COLORS = ['#dfe8f1', '#f7f3ea', '#dcf2e1', '#fde7d4', '#e2e8f0', '#1e293b', '#0f172a', '#0f766e'];

export type Wallpaper =
  | { kind: 'preset'; id: string }
  | { kind: 'color'; color: string }
  | { kind: 'image'; url: string };

export type LastSeenVisibility = 'everyone' | 'contacts' | 'nobody';

export interface Preferences {
  textSize: number;
  bubbleColor: BubbleColorId;
  wallpaper: Wallpaper;
  nightMode: boolean;
  darkTheme: boolean;
  autoDeleteDays: number | null;
  inactiveSessionDays: number;
  animations: boolean;
  sounds: boolean;
  calls: boolean;
  ringtone: RingtoneId;
  unreadCounter: boolean;
  quickReaction: ReactionEmoji;
}

export const DEFAULT_PREFERENCES: Preferences = {
  textSize: 16,
  bubbleColor: 'sky',
  wallpaper: { kind: 'preset', id: 'sky' },
  nightMode: false,
  darkTheme: false,
  autoDeleteDays: null,
  inactiveSessionDays: 30,
  animations: true,
  sounds: true,
  calls: true,
  ringtone: 'classic',
  unreadCounter: true,
  quickReaction: '❤️',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseWallpaper(raw: unknown): Wallpaper {
  if (!isRecord(raw)) return DEFAULT_PREFERENCES.wallpaper;
  if (raw.kind === 'preset' && WALLPAPER_PRESETS.some((preset) => preset.id === raw.id)) {
    return { kind: 'preset', id: String(raw.id) };
  }
  if (raw.kind === 'color' && typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color)) {
    return { kind: 'color', color: raw.color };
  }
  if (raw.kind === 'image' && typeof raw.url === 'string' && /^https:\/\/[^"'\s()\\]+$/.test(raw.url)) {
    return { kind: 'image', url: raw.url };
  }
  return DEFAULT_PREFERENCES.wallpaper;
}

export function parsePreferences(raw: unknown): Preferences {
  const input = isRecord(raw) ? raw : {};
  const size = typeof input.textSize === 'number' ? Math.round(input.textSize) : DEFAULT_PREFERENCES.textSize;
  const bubbleColor = BUBBLE_COLORS.find((color) => color.id === input.bubbleColor)?.id ?? DEFAULT_PREFERENCES.bubbleColor;
  const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

  return {
    textSize: Math.min(TEXT_SIZE_MAX, Math.max(TEXT_SIZE_MIN, size)),
    bubbleColor,
    wallpaper: parseWallpaper(input.wallpaper),
    nightMode: flag(input.nightMode, DEFAULT_PREFERENCES.nightMode),
    darkTheme: flag(input.darkTheme, DEFAULT_PREFERENCES.darkTheme),
    autoDeleteDays:
      typeof input.autoDeleteDays === 'number'
        ? Math.min(3650, Math.max(1, Math.round(input.autoDeleteDays)))
        : DEFAULT_PREFERENCES.autoDeleteDays,
    inactiveSessionDays:
      INACTIVE_SESSION_OPTIONS.find((option) => option === input.inactiveSessionDays) ??
      DEFAULT_PREFERENCES.inactiveSessionDays,
    animations: flag(input.animations, DEFAULT_PREFERENCES.animations),
    sounds: flag(input.sounds, DEFAULT_PREFERENCES.sounds),
    calls: flag(input.calls, DEFAULT_PREFERENCES.calls),
    ringtone: RINGTONE_OPTIONS.find((option) => option.id === input.ringtone)?.id ?? DEFAULT_PREFERENCES.ringtone,
    unreadCounter: flag(input.unreadCounter, DEFAULT_PREFERENCES.unreadCounter),
    quickReaction: REACTION_EMOJIS.find((emoji) => emoji === input.quickReaction) ?? DEFAULT_PREFERENCES.quickReaction,
  };
}

export function wallpaperStyle(wallpaper: Wallpaper): CSSProperties {
  if (wallpaper.kind === 'color') return { backgroundColor: wallpaper.color };
  if (wallpaper.kind === 'image') {
    return { backgroundImage: `url("${wallpaper.url}")`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  const preset = WALLPAPER_PRESETS.find((item) => item.id === wallpaper.id) ?? WALLPAPER_PRESETS[0];
  return { background: preset.background };
}

export function bubbleStyle(colorId: BubbleColorId, mine: boolean, nightMode: boolean): CSSProperties {
  if (mine) {
    const color = BUBBLE_COLORS.find((item) => item.id === colorId) ?? BUBBLE_COLORS[0];
    return { backgroundColor: color.background, color: color.text };
  }
  return nightMode ? { backgroundColor: '#1e293b', color: '#e2e8f0' } : { backgroundColor: '#ffffff', color: '#0f172a' };
}
