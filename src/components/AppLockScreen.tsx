import { useEffect, useState } from 'react';
import { Delete, Lock } from 'lucide-react';
import { PASSCODE_LENGTH } from '@/lib/appLock';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

export default function AppLockScreen({ onUnlock }: { onUnlock: (passcode: string) => Promise<boolean> }) {
  const [entered, setEntered] = useState('');
  const [error, setError] = useState(false);

  const pressDigit = (digit: string) => {
    setError(false);
    setEntered((value) => (value.length < PASSCODE_LENGTH ? value + digit : value));
  };

  const pressDelete = () => {
    setError(false);
    setEntered((value) => (value.length < PASSCODE_LENGTH ? value.slice(0, -1) : value));
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) pressDigit(event.key);
      if (event.key === 'Backspace') pressDelete();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (entered.length !== PASSCODE_LENGTH) return;
    let cancelled = false;
    void onUnlock(entered).then((ok) => {
      if (cancelled || ok) return;
      setError(true);
      setEntered('');
    });
    return () => {
      cancelled = true;
    };
  }, [entered, onUnlock]);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-between bg-gradient-to-b from-slate-800 to-slate-950 px-6 py-14 text-white animate-fade-in">
      <div className="flex flex-col items-center gap-4 pt-8">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
          <Lock size={30} />
        </span>
        <h1 className="text-[22px] font-bold leading-[1.2]">Введите код-пароль</h1>
        <div className={`flex gap-4 ${error ? 'animate-shake' : ''}`} aria-live="polite">
          {Array.from({ length: PASSCODE_LENGTH }, (_, index) => (
            <span
              key={index}
              className={`h-3.5 w-3.5 rounded-full border-2 border-white/70 transition-colors ${
                index < entered.length ? 'bg-white' : ''
              }`}
            />
          ))}
        </div>
        <p className="h-5 text-[14px] text-red-300">{error ? 'Неверный код-пароль' : ''}</p>
      </div>

      <div className="grid w-full max-w-[280px] grid-cols-3 gap-4">
        {KEYS.map((key, index) => {
          if (key === '') return <span key={index} />;
          if (key === 'del') {
            return (
              <button
                key={index}
                type="button"
                onClick={pressDelete}
                aria-label="Удалить"
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white/80 transition active:scale-90 active:bg-white/10"
              >
                <Delete size={24} />
              </button>
            );
          }
          return (
            <button
              key={index}
              type="button"
              onClick={() => pressDigit(key)}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-[26px] font-medium transition active:scale-90 active:bg-white/25"
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
