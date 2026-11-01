import { CheckCircle2, Circle } from 'lucide-react';
import { SettingsGroup } from '@/components/settings/SettingsParts';
import { previewRingtone, RINGTONE_OPTIONS, type RingtoneId } from '@/lib/ringtone';

interface RingtoneChooserProps {
  selected: RingtoneId;
  onSelect: (ringtone: RingtoneId) => void;
}

export default function RingtoneChooser({ selected, onSelect }: RingtoneChooserProps) {
  return (
    <SettingsGroup>
      {RINGTONE_OPTIONS.map((option) => {
        const isSelected = option.id === selected;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              previewRingtone(option.id);
              if (!isSelected) onSelect(option.id);
            }}
            aria-pressed={isSelected}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
          >
            <span className="text-[16px] text-slate-900">{option.label}</span>
            {isSelected ? (
              <CheckCircle2 size={22} className="shrink-0 text-brand-600" />
            ) : (
              <Circle size={22} className="shrink-0 text-slate-300" />
            )}
          </button>
        );
      })}
    </SettingsGroup>
  );
}
