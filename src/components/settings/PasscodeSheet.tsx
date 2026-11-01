import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { PASSCODE_LENGTH, isValidPasscode } from '@/lib/appLock';
import type { AppLock } from '@/hooks/useAppLock';

export type PasscodeMode = 'create' | 'change' | 'disable';

const TITLES: Record<PasscodeMode, string> = {
  create: 'Включить код-пароль',
  change: 'Сменить код-пароль',
  disable: 'Выключить код-пароль',
};

export default function PasscodeSheet({
  mode,
  appLock,
  onClose,
}: {
  mode: PasscodeMode;
  appLock: Pick<AppLock, 'verify' | 'setPasscode' | 'removePasscode'>;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const needsCurrent = mode !== 'create';
  const needsNew = mode !== 'disable';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (needsCurrent && !(await appLock.verify(current))) {
        setError('Неверный текущий код-пароль.');
        return;
      }
      if (needsNew) {
        if (!isValidPasscode(next)) {
          setError(`Код-пароль должен состоять из ${PASSCODE_LENGTH} цифр.`);
          return;
        }
        if (next !== confirm) {
          setError('Коды не совпадают.');
          return;
        }
        await appLock.setPasscode(next);
      } else {
        appLock.removePasscode();
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 animate-fade-in" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[390px] animate-sheet-up rounded-t-3xl bg-white p-5 pb-8 shadow-2xl"
      >
        <h2 className="pb-4 text-[20px] font-bold text-slate-900">{TITLES[mode]}</h2>
        <div className="flex flex-col gap-4">
          {needsCurrent && <CodeField label="Текущий код-пароль" value={current} onChange={setCurrent} />}
          {needsNew && (
            <>
              <CodeField label="Новый код-пароль" value={next} onChange={setNext} />
              <CodeField label="Повторите код-пароль" value={confirm} onChange={setConfirm} />
            </>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-4 animate-shake rounded-xl bg-red-50 px-4 py-2 text-[14px] text-red-600">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-2xl bg-slate-100 text-[16px] font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-[0.98]"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-500 text-[16px] font-semibold text-white transition hover:bg-brand-600 active:scale-[0.98] disabled:opacity-60"
          >
            {busy && <Loader2 size={18} className="animate-spin" />}
            Готово
          </button>
        </div>
      </form>
    </div>
  );
}

function CodeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-slate-500">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={PASSCODE_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, PASSCODE_LENGTH))}
        className="h-12 rounded-xl bg-slate-100 px-4 text-center text-[20px] tracking-[0.5em] text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-500/20"
      />
    </label>
  );
}
