import { useState } from 'react';
import { Check, Image as ImageIcon } from 'lucide-react';
import MessageBubble from '@/components/chat/MessageBubble';
import {
  SectionLabel,
  SettingsGroup,
  SettingsPageShell,
  SettingsRow,
  ToggleRow,
  type SettingsPageProps,
} from '@/components/settings/SettingsParts';
import { usePreferencesSaver } from '@/hooks/usePreferencesSaver';
import { BUBBLE_COLORS, TEXT_SIZE_MAX, TEXT_SIZE_MIN, wallpaperStyle } from '@/lib/preferences';
import { REACTION_EMOJIS } from '@/lib/reactions';

export default function ChatSettings({
  profile,
  onProfileUpdated,
  onError,
  onBack,
  onOpenWallpaper,
}: SettingsPageProps & { onBack: () => void; onOpenWallpaper: () => void }) {
  const prefs = profile.preferences;
  const save = usePreferencesSaver(profile, onProfileUpdated, onError);
  const [sizeDraft, setSizeDraft] = useState(prefs.textSize);
  const selectedColor = BUBBLE_COLORS.find((color) => color.id === prefs.bubbleColor) ?? BUBBLE_COLORS[0];

  const commitSize = () => {
    if (sizeDraft !== prefs.textSize) void save({ ...prefs, textSize: sizeDraft });
  };

  const look = {
    textSize: sizeDraft,
    bubbleColor: prefs.bubbleColor,
    nightMode: prefs.nightMode || prefs.darkTheme,
    animate: prefs.animations,
  };

  return (
    <SettingsPageShell title="Настройки чатов" onBack={onBack}>
      <SectionLabel>Размер текста</SectionLabel>
      <div className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200/70">
        <div className="flex items-center justify-between pb-3">
          <span className="text-[14px] text-slate-500">Aa</span>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-[14px] font-semibold text-brand-700">{sizeDraft} пт</span>
          <span className="text-[24px] font-semibold text-slate-500">Aa</span>
        </div>
        <input
          type="range"
          min={TEXT_SIZE_MIN}
          max={TEXT_SIZE_MAX}
          step={1}
          value={sizeDraft}
          aria-label="Размер текста"
          onChange={(e) => setSizeDraft(Number(e.target.value))}
          onPointerUp={commitSize}
          onKeyUp={commitSize}
          className="w-full cursor-pointer accent-brand-500"
        />
      </div>

      <SectionLabel>Пример</SectionLabel>
      <div
        className="relative overflow-hidden rounded-2xl ring-1 ring-slate-200/70"
        style={wallpaperStyle(prefs.wallpaper)}
      >
        {prefs.nightMode && <div className="pointer-events-none absolute inset-0 bg-slate-950/40" />}
        <div className="relative flex flex-col gap-2 px-3 py-4">
          <div className="flex justify-end">
            <MessageBubble text="Доброе утро!" time="09:41" mine quote={null} {...look} />
          </div>
          <div className="flex justify-start">
            <MessageBubble
              text="Знаешь, который час?"
              time="09:42"
              mine={false}
              quote={{ author: profile.display_name, text: 'Доброе утро!' }}
              {...look}
            />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <SettingsGroup>
          <SettingsRow
            icon={ImageIcon}
            label="Изменить обои"
            description="Готовые обои, одноцветный фон или фото из галереи"
            onClick={onOpenWallpaper}
          />
        </SettingsGroup>
      </div>

      <SectionLabel>Цвет сообщений</SectionLabel>
      <div className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200/70">
        <div className="grid grid-cols-6 gap-2">
          {BUBBLE_COLORS.map((color) => {
            const selected = color.id === prefs.bubbleColor;
            return (
              <button
                key={color.id}
                type="button"
                aria-label={color.label}
                aria-pressed={selected}
                onClick={() => {
                  if (!selected) void save({ ...prefs, bubbleColor: color.id });
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition active:scale-90 ${
                  selected ? 'ring-2 ring-brand-500 ring-offset-2' : 'ring-1 ring-slate-200'
                }`}
                style={{ backgroundColor: color.background }}
              >
                {selected && <Check size={18} style={{ color: color.text }} />}
              </button>
            );
          })}
        </div>
        <p className="pt-3 text-[13px] text-slate-500">
          Цвет ваших сообщений: <span className="font-medium text-slate-700">{selectedColor.label}</span>
        </p>
      </div>

      <SectionLabel>Быстрая реакция</SectionLabel>
      <div className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200/70">
        <div className="grid grid-cols-6 gap-2">
          {REACTION_EMOJIS.map((emoji) => {
            const selected = emoji === prefs.quickReaction;
            return (
              <button
                key={emoji}
                type="button"
                aria-label={`Быстрая реакция ${emoji}`}
                aria-pressed={selected}
                onClick={() => {
                  if (!selected) void save({ ...prefs, quickReaction: emoji });
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-[20px] transition active:scale-90 ${
                  selected ? 'bg-brand-50 ring-2 ring-brand-500 ring-offset-2' : 'ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
        <p className="pt-3 text-[13px] text-slate-500">
          Двойной тап по сообщению ставит реакцию <span className="font-medium text-slate-700">{prefs.quickReaction}</span>
        </p>
      </div>

      <div className="mt-4">
        <SettingsGroup>
          <ToggleRow
            label="Тёмная тема"
            description="Тёмное оформление всего приложения"
            checked={prefs.darkTheme}
            onChange={(checked) => void save({ ...prefs, darkTheme: checked })}
          />
          <ToggleRow
            label="Ночной режим"
            description="Затемняет обои и делает чужие сообщения темными"
            checked={prefs.nightMode}
            onChange={(checked) => void save({ ...prefs, nightMode: checked })}
          />
          <ToggleRow
            label="Анимации"
            description="Плавное появление сообщений и переходов"
            checked={prefs.animations}
            onChange={(checked) => void save({ ...prefs, animations: checked })}
          />
        </SettingsGroup>
      </div>
    </SettingsPageShell>
  );
}
