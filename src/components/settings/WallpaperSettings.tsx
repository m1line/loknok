import { useRef, useState } from 'react';
import { Check, ImagePlus, Loader2 } from 'lucide-react';
import { SectionLabel, SettingsPageShell, type SettingsPageProps } from '@/components/settings/SettingsParts';
import { usePreferencesSaver } from '@/hooks/usePreferencesSaver';
import { SOLID_WALLPAPER_COLORS, WALLPAPER_PRESETS, wallpaperStyle, type Wallpaper } from '@/lib/preferences';
import { uploadProfileImage } from '@/lib/storage';

export default function WallpaperSettings({
  profile,
  onProfileUpdated,
  onError,
  onBack,
}: SettingsPageProps & { onBack: () => void }) {
  const prefs = profile.preferences;
  const save = usePreferencesSaver(profile, onProfileUpdated, onError);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const setWallpaper = (wallpaper: Wallpaper) => void save({ ...prefs, wallpaper });
  const isSelected = (wallpaper: Wallpaper) => {
    const current = prefs.wallpaper;
    if (current.kind !== wallpaper.kind) return false;
    if (current.kind === 'preset' && wallpaper.kind === 'preset') return current.id === wallpaper.id;
    if (current.kind === 'color' && wallpaper.kind === 'color') return current.color === wallpaper.color;
    return false;
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadProfileImage('wallpapers', profile.id, file);
      setWallpaper({ kind: 'image', url });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Не удалось загрузить фото.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <SettingsPageShell title="Обои" onBack={onBack}>
      <SectionLabel>Готовые обои</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        {WALLPAPER_PRESETS.map((preset) => {
          const wallpaper: Wallpaper = { kind: 'preset', id: preset.id };
          const selected = isSelected(wallpaper);
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setWallpaper(wallpaper)}
              className="flex flex-col gap-1.5 text-left transition active:scale-[0.98]"
            >
              <span
                className={`relative block h-24 w-full rounded-2xl ring-1 ring-slate-200 ${selected ? 'ring-2 ring-brand-500' : ''}`}
                style={wallpaperStyle(wallpaper)}
              >
                {selected && (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white shadow">
                    <Check size={14} />
                  </span>
                )}
              </span>
              <span className="text-[14px] font-medium text-slate-800">{preset.label}</span>
            </button>
          );
        })}
      </div>

      <SectionLabel>Одноцветный фон</SectionLabel>
      <div className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200/70">
        <div className="grid grid-cols-8 gap-2">
          {SOLID_WALLPAPER_COLORS.map((color) => {
            const wallpaper: Wallpaper = { kind: 'color', color };
            const selected = isSelected(wallpaper);
            return (
              <button
                key={color}
                type="button"
                aria-label={`Цвет ${color}`}
                aria-pressed={selected}
                onClick={() => setWallpaper(wallpaper)}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90 ${
                  selected ? 'ring-2 ring-brand-500 ring-offset-2' : 'ring-1 ring-slate-200'
                }`}
                style={{ backgroundColor: color }}
              />
            );
          })}
        </div>
        <label className="mt-4 flex items-center justify-between gap-3 text-[15px] text-slate-800">
          Свой цвет
          <input
            type="color"
            aria-label="Свой цвет фона"
            value={prefs.wallpaper.kind === 'color' ? prefs.wallpaper.color : '#dfe8f1'}
            onChange={(e) => setWallpaper({ kind: 'color', color: e.target.value })}
            className="h-9 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
          />
        </label>
      </div>

      <SectionLabel>Из галереи</SectionLabel>
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={uploading}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 text-[16px] font-semibold text-white shadow-md shadow-brand-500/25 transition hover:bg-brand-600 active:scale-[0.98] disabled:opacity-60"
      >
        {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
        Выбрать фото
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUpload(file);
        }}
      />
      {prefs.wallpaper.kind === 'image' && (
        <div
          className="mt-3 h-32 w-full rounded-2xl ring-2 ring-brand-500"
          style={wallpaperStyle(prefs.wallpaper)}
          aria-label="Текущее фото обоев"
          role="img"
        />
      )}
    </SettingsPageShell>
  );
}
