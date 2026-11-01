import { useState } from 'react';
import ChatListScreen from '@/components/ChatListScreen';
import ChatScreen from '@/components/ChatScreen';
import ContactsScreen from '@/components/ContactsScreen';
import SettingsScreen from '@/components/SettingsScreen';
import PostsScreen from '@/components/PostsScreen';
import TabBar, { type Tab } from '@/components/TabBar';
import CallOverlay from '@/components/call/CallOverlay';
import { useCallManager } from '@/hooks/useCallManager';
import { useCallVibration, useMessageVibration } from '@/hooks/useVibrationAlerts';
import type { useAppLock } from '@/hooks/useAppLock';
import type { useMyProfile } from '@/hooks/useMyProfile';
import type { MyProfile, Profile } from '@/lib/types';

interface OpenChat {
  chatId: string;
  peer: Profile;
}

interface MessengerHomeProps {
  profile: MyProfile;
  setProfile: ReturnType<typeof useMyProfile>['setProfile'];
  appLock: ReturnType<typeof useAppLock>;
  notify: (text: string) => void;
  toast: { key: number; text: string } | null;
}

export default function MessengerHome({ profile, setProfile, appLock, notify, toast }: MessengerHomeProps) {
  const [tab, setTab] = useState<Tab>('chats');
  const [openChat, setOpenChat] = useState<OpenChat | null>(null);
  const calls = useCallManager(profile, notify);
  const vibrationEnabled = profile.preferences.sounds;
  useMessageVibration(profile.id, vibrationEnabled);
  useCallVibration(vibrationEnabled, calls.call?.phase === 'incoming');

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {tab === 'chats' && (
          <ChatListScreen
            myProfileId={profile.id}
            onOpenChat={(chatId, peer) => setOpenChat({ chatId, peer })}
          />
        )}
        {tab === 'contacts' && (
          <ContactsScreen
            myProfileId={profile.id}
            onOpenChat={(chatId, peer) => setOpenChat({ chatId, peer })}
            onError={notify}
          />
        )}
        {tab === 'posts' && <PostsScreen profile={profile} />}
        {tab === 'settings' && (
          <SettingsScreen profile={profile} onProfileUpdated={setProfile} onError={notify} appLock={appLock} />
        )}
      </div>

      <TabBar active={tab} onChange={setTab} />

      {openChat && (
        <div className="absolute inset-0 z-20">
          <ChatScreen
            key={openChat.chatId}
            chatId={openChat.chatId}
            peer={openChat.peer}
            me={profile}
            onBack={() => setOpenChat(null)}
            onStartCall={calls.startCall}
          />
        </div>
      )}

      {calls.call && (
        <CallOverlay
          call={calls.call}
          ringtone={profile.preferences.ringtone}
          localStream={calls.localStream}
          remoteStream={calls.remoteStream}
          onAccept={() => void calls.acceptCall()}
          onDecline={() => void calls.declineCall()}
          onHangUp={calls.hangUp}
          onToggleMute={calls.toggleMute}
            onToggleCamera={calls.toggleCamera}
          />
      )}

      {toast && (
        <div
          key={toast.key}
          role="status"
          className="pointer-events-none absolute left-1/2 top-14 z-50 w-max max-w-[85%] -translate-x-1/2 animate-toast-in rounded-full bg-slate-900/90 px-4 py-2 text-center text-[14px] font-medium text-white shadow-lg"
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
