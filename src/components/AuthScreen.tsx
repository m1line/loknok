import { useState, type FormEvent } from 'react';
import { Loader2, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import QrLoginPanel from '@/components/QrLoginPanel';

type Mode = 'signin' | 'signup';

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

function describeAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'Неверный email или пароль.';
  if (lower.includes('already registered')) return 'Этот email уже зарегистрирован.';
  if (lower.includes('at least')) return 'Пароль должен быть не короче 6 символов.';
  if (lower.includes('rate limit') || lower.includes('too many')) return 'Слишком много попыток. Подождите немного.';
  if (lower.includes('database error')) return 'Не удалось создать аккаунт. Попробуйте другое имя пользователя.';
  return 'Что-то пошло не так. Попробуйте еще раз.';
}

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [qrMode, setQrMode] = useState(false);

  const isSignup = mode === 'signup';

  const fail = (message: string) => {
    setError(message);
    setShakeKey((key) => key + 1);
    setSubmitting(false);
  };

  const validate = (): string | null => {
    if (!email.trim() || !password) return 'Введите email и пароль.';
    if (!isSignup) return null;
    if (!displayName.trim() || displayName.trim().length > 64) return 'Введите имя от 1 до 64 символов.';
    if (!USERNAME_PATTERN.test(username)) {
      return 'Имя пользователя: от 3 до 32 символов, только латинские буквы, цифры и _.';
    }
    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const validationError = validate();
    if (validationError) {
      fail(validationError);
      return;
    }

    setError(null);
    setSubmitting(true);

    if (!isSignup) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) fail(describeAuthError(signInError.message));
      else setSubmitting(false);
      return;
    }

    const { data: available, error: checkError } = await supabase.rpc('is_username_available', {
      p_username: username,
    });
    if (checkError) {
      fail('Не удалось проверить имя пользователя. Попробуйте еще раз.');
      return;
    }
    if (available !== true) {
      fail('Это имя пользователя уже занято.');
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username, display_name: displayName.trim() },
      },
    });

    if (signUpError) {
      fail(describeAuthError(signUpError.message));
      return;
    }

    if (!data.session) {
      const { error: followUpError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (followUpError) {
        fail(describeAuthError(followUpError.message));
        return;
      }
    }
    setSubmitting(false);
  };

  const switchMode = () => {
    setMode(isSignup ? 'signin' : 'signup');
    setError(null);
  };

  if (qrMode) return <QrLoginPanel onBack={() => setQrMode(false)} />;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gradient-to-b from-brand-50 via-white to-white px-6 pb-10 pt-16">
      <div className="animate-rise-in flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-brand-500 text-white shadow-lg shadow-brand-500/30">
          <MessageCircle size={40} strokeWidth={2} />
        </div>
        <h1 className="mt-6 text-[28px] font-bold leading-[1.2] text-slate-900">Сигнал</h1>
        <p className="mt-2 text-[15px] leading-[1.5] text-slate-500">
          {isSignup ? 'Создайте аккаунт, чтобы начать общение' : 'Войдите, чтобы продолжить переписку'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-3">
        {isSignup && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-slate-600">Имя</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={64}
                autoComplete="name"
                className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-[16px] text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                placeholder="Как вас зовут"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-slate-600">Имя пользователя</span>
              <div className="flex h-12 items-center rounded-xl border border-slate-200 bg-white px-4 transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15">
                <span className="text-slate-400">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  maxLength={32}
                  autoComplete="username"
                  className="ml-1 w-full bg-transparent text-[16px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  placeholder="username"
                />
              </div>
            </label>
          </>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-slate-600">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-[16px] text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            placeholder="you@example.com"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-slate-600">Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-[16px] text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            placeholder="Не короче 6 символов"
          />
        </label>

        {error && (
          <p key={shakeKey} role="alert" className="animate-shake rounded-xl bg-red-50 px-4 py-3 text-[14px] leading-[1.5] text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 text-[16px] font-semibold text-white shadow-md shadow-brand-500/25 transition hover:bg-brand-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting && <Loader2 size={18} className="animate-spin" />}
          {isSignup ? 'Создать аккаунт' : 'Войти'}
        </button>
      </form>

      <button
        type="button"
        onClick={switchMode}
        className="mt-6 text-center text-[15px] font-medium text-brand-600 transition hover:text-brand-700"
      >
        {isSignup ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
      </button>

      {!isSignup && (
        <button
          type="button"
          onClick={() => setQrMode(true)}
          className="mt-3 text-center text-[15px] font-medium text-slate-600 transition hover:text-brand-600"
        >
          Войти по QR-коду с телефона
        </button>
      )}
    </div>
  );
}
