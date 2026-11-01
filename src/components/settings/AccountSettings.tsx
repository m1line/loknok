import { useRef, useState, type FormEvent } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import Avatar from '@/components/Avatar';
import ProfilePhotoHistory from '@/components/profile/ProfilePhotoHistory';
import StoriesSection from '@/components/profile/StoriesSection';
import {
  SectionLabel,
  SettingsGroup,
  SettingsPageShell,
  type SettingsPageProps,
} from '@/components/settings/SettingsParts';
import { isUsernameFree, saveBirthDate, updateProfile } from '@/lib/profiles';
import { uploadProfileImage } from '@/lib/storage';
import type { MyProfile, ProfilePatch } from '@/lib/types';

const MAX_BIO = 280;
const MAX_NAME = 64;
const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

function splitFirstName(profile: MyProfile): string {
  const suffix = ` ${profile.last_name}`;
  if (profile.last_name && profile.display_name.endsWith(suffix)) {
    return profile.display_name.slice(0, -suffix.length);
  }
  return profile.display_name;
}

export default function AccountSettings({
  profile,
  onProfileUpdated,
  onError,
  onBack,
}: SettingsPageProps & { onBack: () => void }) {
  const [firstName, setFirstName] = useState(() => splitFirstName(profile));
  const [lastName, setLastName] = useState(profile.last_name);
  const [username, setUsername] = useState(profile.username);
  const [birthDate, setBirthDate] = useState(profile.birth_date ?? '');
  const [bio, setBio] = useState(profile.bio);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const cleanFirst = firstName.trim();
  const cleanLast = lastName.trim();
  const cleanUsername = username.trim();
  const dirty =
    cleanFirst !== splitFirstName(profile) ||
    cleanLast !== profile.last_name ||
    cleanUsername !== profile.username ||
    bio !== profile.bio ||
    (birthDate || null) !== profile.birth_date;

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSaved(false);

    if (cleanFirst.length === 0 || cleanFirst.length > MAX_NAME) {
      setFormError('Имя должно быть от 1 до 64 символов.');
      return;
    }
    if (cleanLast.length > MAX_NAME) {
      setFormError('Фамилия не длиннее 64 символов.');
      return;
    }
    if (!USERNAME_PATTERN.test(cleanUsername)) {
      setFormError('Имя пользователя: от 3 до 32 символов, латинские буквы, цифры и _.');
      return;
    }
    if (bio.length > MAX_BIO) {
      setFormError(`Описание не длиннее ${MAX_BIO} символов.`);
      return;
    }

    setSaving(true);
    try {
      if (cleanUsername !== profile.username && !(await isUsernameFree(cleanUsername, profile.username))) {
        setFormError('Это имя пользователя уже занято.');
        return;
      }

      const patch: ProfilePatch = {};
      const displayName = `${cleanFirst} ${cleanLast}`.trim();
      if (displayName !== profile.display_name) patch.display_name = displayName;
      if (cleanLast !== profile.last_name) patch.last_name = cleanLast;
      if (cleanUsername !== profile.username) patch.username = cleanUsername;
      if (bio !== profile.bio) patch.bio = bio;

      let next: MyProfile = profile;
      if (Object.keys(patch).length > 0) {
        next = { ...next, ...(await updateProfile(profile.id, patch)) };
      }
      const nextBirth = birthDate || null;
      if (nextBirth !== profile.birth_date) {
        await saveBirthDate(profile.id, nextBirth);
        next = { ...next, birth_date: nextBirth };
      }

      onProfileUpdated(next);
      setSaved(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Не удалось сохранить.');
    } finally {
      setSaving(false);
    }
  };

  const handlePhoto = async (file: File) => {
    setPhotoBusy(true);
    try {
      const url = await uploadProfileImage('avatars', profile.id, file);
      onProfileUpdated({ ...profile, ...(await updateProfile(profile.id, { avatar_url: url })) });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Не удалось загрузить фото.');
    } finally {
      setPhotoBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoBusy(true);
    try {
      onProfileUpdated({ ...profile, ...(await updateProfile(profile.id, { avatar_url: '' })) });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Не удалось удалить фото.');
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <SettingsPageShell title="Аккаунт" onBack={onBack}>
      <div className="flex flex-col items-center pb-2 animate-rise-in">
        <div className="relative">
          <Avatar
            name={profile.display_name}
            seed={profile.username}
            size={104}
            isBot={profile.is_bot}
            imageUrl={profile.avatar_url}
          />
          {photoBusy && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/60">
              <Loader2 className="animate-spin text-brand-500" size={26} />
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={photoBusy}
            className="flex h-9 items-center gap-2 rounded-full bg-brand-500 px-4 text-[14px] font-semibold text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-60"
          >
            <Camera size={16} /> Сменить фото
          </button>
          {profile.avatar_url && (
            <button
              type="button"
              onClick={() => void handleRemovePhoto()}
              disabled={photoBusy}
              className="flex h-9 items-center gap-2 rounded-full bg-red-50 px-4 text-[14px] font-semibold text-red-600 transition hover:bg-red-100 active:scale-95 disabled:opacity-60"
            >
              <Trash2 size={16} /> Удалить
            </button>
          )}
        </div>
        <div className="mt-6 w-full">
          <StoriesSection profileId={profile.id} isOwner />
        </div>
        <div className="mt-6 w-full">
          <ProfilePhotoHistory profileId={profile.id} />
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handlePhoto(file);
          }}
        />
      </div>

      <form id="account-form" onSubmit={handleSave} className="flex flex-col">
        <SectionLabel>Имя</SectionLabel>
        <SettingsGroup>
          <label className="flex flex-col gap-1 px-4 py-3">
            <span className="text-[13px] font-medium text-slate-500">Имя</span>
            <input
              value={firstName}
              maxLength={MAX_NAME}
              onChange={(e) => setFirstName(e.target.value)}
              className="bg-transparent text-[16px] text-slate-900 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 px-4 py-3">
            <span className="text-[13px] font-medium text-slate-500">Фамилия</span>
            <input
              value={lastName}
              maxLength={MAX_NAME}
              onChange={(e) => setLastName(e.target.value)}
              className="bg-transparent text-[16px] text-slate-900 focus:outline-none"
            />
          </label>
        </SettingsGroup>

        <SectionLabel>Информация о вас</SectionLabel>
        <SettingsGroup>
          <div className="flex flex-col gap-1 px-4 py-3">
            <span className="text-[13px] font-medium text-slate-500">Номер телефона</span>
            <span className="flex items-center justify-between gap-3">
              <span className="text-[16px] text-slate-400">Не подключен</span>
            </span>
            <span className="text-[12px] leading-[1.4] text-slate-500">
              Подтверждение номера по SMS-коду пока недоступно.
            </span>
          </div>
          <label className="flex flex-col gap-1 px-4 py-3">
            <span className="text-[13px] font-medium text-slate-500">Имя пользователя</span>
            <span className="flex items-center text-[16px] text-slate-900">
              <span className="text-slate-400">@</span>
              <input
                value={username}
                maxLength={32}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                autoCapitalize="none"
                autoComplete="off"
                className="w-full bg-transparent focus:outline-none"
              />
            </span>
          </label>
          <label className="flex flex-col gap-1 px-4 py-3">
            <span className="text-[13px] font-medium text-slate-500">Дата рождения</span>
            <input
              type="date"
              value={birthDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setBirthDate(e.target.value)}
              className="bg-transparent text-[16px] text-slate-900 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 px-4 py-3">
            <span className="flex items-center justify-between text-[13px] font-medium text-slate-500">
              О себе
              <span className={bio.length > MAX_BIO ? 'text-red-600' : ''}>
                {bio.length}/{MAX_BIO}
              </span>
            </span>
            <textarea
              value={bio}
              rows={3}
              onChange={(e) => setBio(e.target.value)}
              className="resize-none bg-transparent text-[16px] leading-[1.5] text-slate-900 focus:outline-none"
            />
          </label>
        </SettingsGroup>

        <SectionLabel>Каналы</SectionLabel>
        <SettingsGroup>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[16px] text-slate-900">Личный канал</p>
              <p className="text-[13px] text-slate-500">Создание каналов скоро появится</p>
            </div>
            <button
              type="button"
              disabled
              className="h-9 shrink-0 rounded-full bg-slate-200 px-4 text-[14px] font-semibold text-slate-500"
            >
              Добавить
            </button>
          </div>
        </SettingsGroup>

        {formError && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-[14px] text-red-600 animate-shake">
            {formError}
          </p>
        )}
        {saved && !dirty && <p className="mt-4 px-1 text-[14px] text-emerald-600">Изменения сохранены.</p>}

        <button
          type="submit"
          disabled={!dirty || saving}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 text-[16px] font-semibold text-white shadow-md shadow-brand-500/25 transition hover:bg-brand-600 active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none"
        >
          {saving && <Loader2 size={18} className="animate-spin" />}
          Сохранить
        </button>
      </form>
    </SettingsPageShell>
  );
}
