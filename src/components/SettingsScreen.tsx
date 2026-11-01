import { useState } from 'react';
import {
  Bell,
  BatteryMedium,
  ChevronRight,
  Crown,
  Database,
  Folder,
  Globe,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  Smartphone,
  User,
  type LucideIcon,
} from 'lucide-react';
import Avatar from '@/components/Avatar';
import InstallButton from '@/components/InstallButton';
import AccountSettings from '@/components/settings/AccountSettings';
import SecuritySettings from '@/components/settings/SecuritySettings';
import type { AppLock } from '@/hooks/useAppLock';
import ChatSettings from '@/components/settings/ChatSettings';
import ComingSoonSettings from '@/components/settings/ComingSoonSettings';
import DevicesSettings from '@/components/settings/DevicesSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
import PremiumSettings from '@/components/settings/PremiumSettings';
import PrivacySettings from '@/components/settings/PrivacySettings';
import WallpaperSettings from '@/components/settings/WallpaperSettings';
import { SettingsGroup, SettingsRow, type SettingsPageProps } from '@/components/settings/SettingsParts';
import { supabase } from '@/lib/supabase';
import type { MyProfile } from '@/lib/types';

type SettingsPage =
  | 'root'
  | 'account'
  | 'chats'
  | 'wallpaper'
  | 'privacy'
  | 'security'
  | 'notifications'
  | 'data'
  | 'folders'
  | 'devices'
  | 'passkeys'
  | 'battery'
  | 'language'
  | 'premium';

const COMING_SOON_TITLES: Partial<Record<SettingsPage, string>> = {
  data: 'Данные и память',
  folders: 'Папки с чатами',
  passkeys: 'Ключи доступа',
  battery: 'Энергосбережение',
  language: 'Язык',
};

const MENU: { page: SettingsPage; label: string; description: string; icon: LucideIcon }[] = [
  { page: 'account', label: 'Аккаунт', description: 'Номер, имя пользователя, О себе', icon: User },
  { page: 'chats', label: 'Настройки чатов', description: 'Обои, ночной режим, анимации', icon: MessageSquare },
  { page: 'privacy', label: 'Конфиденциальность', description: 'Время захода, устройства, ключи доступа', icon: Lock },
  { page: 'notifications', label: 'Уведомления', description: 'Звуки, звонки, счетчик сообщений', icon: Bell },
  { page: 'data', label: 'Данные и память', description: 'Хранилище, загрузки, кэш', icon: Database },
  { page: 'folders', label: 'Папки с чатами', description: 'Группировка чатов по папкам', icon: Folder },
  { page: 'devices', label: 'Устройства', description: 'Входы в аккаунт с других устройств', icon: Smartphone },
  { page: 'battery', label: 'Энергосбережение', description: 'Экономия заряда и батареи', icon: BatteryMedium },
  { page: 'language', label: 'Язык', description: 'Язык интерфейса', icon: Globe },
];

export default function SettingsScreen({
  profile,
  onProfileUpdated,
  onError,
  appLock,
}: SettingsPageProps & { appLock: AppLock }) {
  const [page, setPage] = useState<SettingsPage>('root');
  const [signingOut, setSigningOut] = useState(false);
  const back = () => setPage('root');

  const handleSignOut = async () => {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSigningOut(false);
      onError('Не удалось выйти. Попробуйте еще раз.');
    }
  };

  const pageProps = { profile, onProfileUpdated, onError };

  if (page === 'account') return <AccountSettings {...pageProps} onBack={back} />;
  if (page === 'chats') {
    return <ChatSettings {...pageProps} onBack={back} onOpenWallpaper={() => setPage('wallpaper')} />;
  }
  if (page === 'wallpaper') return <WallpaperSettings {...pageProps} onBack={() => setPage('chats')} />;
  if (page === 'privacy') {
    return (
      <PrivacySettings
        {...pageProps}
        onBack={back}
        onOpenPremium={() => setPage('premium')}
        onOpenSection={(section) => setPage(section)}
      />
    );
  }
  if (page === 'security' || page === 'passkeys') return <SecuritySettings appLock={appLock} onBack={() => setPage('privacy')} />;
  if (page === 'devices') return <DevicesSettings {...pageProps} onBack={back} />;
  if (page === 'notifications') return <NotificationSettings {...pageProps} onBack={back} />;
  if (page === 'premium') return <PremiumSettings profile={profile} onBack={back} />;
  if (page !== 'root') return <ComingSoonSettings title={COMING_SOON_TITLES[page] ?? ''} onBack={back} />;

  return (
    <section className="flex h-full flex-col animate-fade-in">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/85 px-5 pb-3 pt-3 backdrop-blur-xl">
        <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-slate-900">Настройки</h1>
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-10 pt-5">
        <InstallButton />
        <button
          type="button"
          onClick={() => setPage('account')}
          className="mb-5 flex w-full animate-rise-in items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50 active:scale-[0.99]"
        >
          <Avatar
            name={profile.display_name}
            seed={profile.username}
            size={64}
            isBot={profile.is_bot}
            imageUrl={profile.avatar_url}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-semibold text-slate-900">
              {profile.display_name} {profile.last_name}
            </p>
            <p className="truncate text-[14px] text-slate-500">@{profile.username}</p>
            {profile.bio && <p className="mt-1 truncate text-[13px] text-slate-500">{profile.bio}</p>}
          </div>
          <ChevronRight size={18} className="shrink-0 text-slate-300" />
        </button>

        <SettingsGroup>
          {MENU.map((item) => (
            <SettingsRow
              key={item.page}
              icon={item.icon}
              label={item.label}
              description={item.description}
              value={menuValue(item.page, profile)}
              onClick={() => setPage(item.page)}
            />
          ))}
        </SettingsGroup>

        <div className="mt-4">
          <SettingsGroup>
            <SettingsRow
              icon={Crown}
              label="Premium"
              description="Расширенные возможности аккаунта"
              value={profile.is_premium ? 'Активен' : undefined}
              premium
              onClick={() => setPage('premium')}
            />
          </SettingsGroup>
        </div>

        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[16px] font-semibold text-red-600 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-red-50 active:scale-[0.98] disabled:opacity-60"
        >
          {signingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
          Выйти из аккаунта
        </button>
      </div>
    </section>
  );
}

function menuValue(page: SettingsPage, profile: MyProfile): string | undefined {
  if (page === 'notifications') return profile.notify_messages ? 'Вкл.' : 'Выкл.';
  if (page === 'language') return 'Русский';
  return undefined;
}
