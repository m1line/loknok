import type { LastSeenVisibility, Preferences } from '@/lib/preferences';

export type WhoCanMessage = 'everyone' | 'contacts';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  last_name: string;
  bio: string;
  is_bot: boolean;
  avatar_url: string;
  is_premium: boolean;
  who_can_message: WhoCanMessage;
  last_seen_visibility: LastSeenVisibility;
  notify_messages: boolean;
  notify_previews: boolean;
}

export interface MyProfile extends Profile {
  birth_date: string | null;
  preferences: Preferences;
}

export type ProfilePatch = Partial<
  Pick<
    Profile,
    | 'username'
    | 'display_name'
    | 'last_name'
    | 'bio'
    | 'avatar_url'
    | 'who_can_message'
    | 'last_seen_visibility'
    | 'notify_messages'
    | 'notify_previews'
  >
>;

export const PROFILE_COLUMNS =
  'id, username, display_name, last_name, bio, is_bot, avatar_url, is_premium, who_can_message, last_seen_visibility, notify_messages, notify_previews';

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  reply_to_id: string | null;
  sticker_url: string | null;
  media_url: string | null;
  media_kind: MediaKind | null;
  edited_at: string | null;
}

export type MediaKind = 'voice' | 'circle';

export interface MessageAttachment {
  sticker_url?: string;
  media_url?: string;
  media_kind?: MediaKind;
}

export interface MessageReactionRow {
  message_id: string;
  profile_id: string;
  emoji: string;
}

export interface ProfilePhoto {
  id: string;
  image_url: string;
  created_at: string;
}

export interface Story {
  id: string;
  profile_id: string;
  image_url: string;
  audio_url?: string | null;
  caption: string;
  created_at: string;
  expires_at: string;
}

export interface Sticker {
  id: string;
  pack_id: string;
  image_url: string;
}

export interface StickerPack {
  id: string;
  owner_id: string;
  title: string;
  is_public: boolean;
  stickers: Sticker[];
}

export interface ChatSummary {
  chatId: string;
  peer: Profile;
  lastMessage: Message | null;
  unreadCount: number;
}
