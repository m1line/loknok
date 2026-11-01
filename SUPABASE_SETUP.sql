-- ЕДИНАЯ НАСТРОЙКА БАЗЫ ДАННЫХ ДЛЯ ЭТОГО ПРОЕКТА
-- Выполнять целиком в Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Не выполнять в Logs query / Logs Explorer: там разрешены только SELECT.
-- Скрипт собран из миграций самого проекта; повторный запуск рассчитан на существующие таблицы.
-- Он не удаляет аккаунты, сообщения, чаты или публикации.



-- ============================================================
-- MIGRATION: 20261031200730_create_messenger_schema.sql
-- ============================================================

/*
# Messenger core schema

Plain-English summary: adds everything a Telegram-style messenger needs. Users sign up with email and password and pick a username. They can add other people or bots to their contacts, open a one-to-one chat, and exchange messages in real time. Two built-in bots (a helper and an echo bot) answer automatically.

1. New Tables
- `profiles`: one row per person or bot. Username, display name, bio, and an is_bot flag. Humans link to their sign-in account through `user_id`; bots have no sign-in account.
- `contacts`: who a user has added to their friends/contacts list.
- `chats`: a conversation container.
- `chat_members`: which profiles belong to which chat.
- `messages`: text messages inside a chat.

2. New Functions
- `current_profile_id()`: returns the profile of the signed-in user.
- `is_chat_member(chat_id)`: checks whether the signed-in user belongs to a chat.
- `open_direct_chat(profile_id)`: finds or creates a one-to-one chat.
- `is_username_available(username)`: lets the sign-up form check a username before creating an account.
- `handle_new_user()`: creates a profile automatically when an account is created.
- `bot_auto_reply()`: makes bots answer messages sent in their chats.

3. Security
- RLS enabled on every new table.
- Profiles are readable by signed-in users (public directory, like Telegram usernames). Users can only update their own display name and bio.
- Contacts, chats, members and messages are restricted to their owners or chat members.
- Helper functions are not callable by anonymous visitors, except the username availability check.

4. Notes
- Realtime is enabled for messages and chat membership so new messages and new chats appear instantly.
- Two bots are seeded: helper_bot and echo_bot.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,32}$'),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 64),
  bio text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 280),
  is_bot boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (is_bot = (user_id IS NULL))
);

CREATE TABLE IF NOT EXISTS public.contacts (
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, contact_id),
  CHECK (owner_id <> contact_id)
);

CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_members (
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, profile_id)
);

CREATE INDEX IF NOT EXISTS chat_members_profile_idx ON public.chat_members (profile_id);

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_chat_member(p_chat_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_members m
    WHERE m.chat_id = p_chat_id AND m.profile_id = public.current_profile_id()
  );
$$;

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT public.current_profile_id() REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_chat_created_idx ON public.messages (chat_id, created_at);

CREATE OR REPLACE FUNCTION public.open_direct_chat(p_other_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := public.current_profile_id();
  existing uuid;
  new_chat uuid;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  IF p_other_profile_id = me THEN
    RAISE EXCEPTION 'Cannot open a chat with yourself';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_other_profile_id) THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  SELECT a.chat_id INTO existing
  FROM public.chat_members a
  JOIN public.chat_members b ON b.chat_id = a.chat_id
  WHERE a.profile_id = me AND b.profile_id = p_other_profile_id
  LIMIT 1;

  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  INSERT INTO public.chats DEFAULT VALUES RETURNING id INTO new_chat;
  INSERT INTO public.chat_members (chat_id, profile_id)
  VALUES (new_chat, me), (new_chat, p_other_profile_id);

  RETURN new_chat;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_username_available(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = lower(p_username));
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    NEW.id,
    lower(COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), 'user_' || substr(replace(NEW.id::text, '-', ''), 1, 12))),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), 'User')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.bot_auto_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  bot_row public.profiles%ROWTYPE;
  sender_is_bot boolean;
  reply text;
  cmd text := lower(trim(NEW.body));
BEGIN
  SELECT p.is_bot INTO sender_is_bot FROM public.profiles p WHERE p.id = NEW.sender_id;
  IF sender_is_bot THEN
    RETURN NEW;
  END IF;

  SELECT p.* INTO bot_row
  FROM public.chat_members m
  JOIN public.profiles p ON p.id = m.profile_id
  WHERE m.chat_id = NEW.chat_id AND p.is_bot
  LIMIT 1;

  IF bot_row.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF bot_row.username = 'echo_bot' THEN
    reply := NEW.body;
  ELSIF cmd = '/start' THEN
    reply := 'Привет! Я помощник. Напишите /help, чтобы узнать, что я умею.';
  ELSIF cmd = '/help' THEN
    reply := 'Команды: /start, /help, /time. Можно также просто написать мне сообщение, и я отвечу.';
  ELSIF cmd = '/time' THEN
    reply := 'Сейчас ' || to_char(now() AT TIME ZONE 'UTC', 'DD.MM.YYYY HH24:MI') || ' (UTC).';
  ELSE
    reply := 'Я получил ваше сообщение: "' || left(NEW.body, 200) || '"';
  END IF;

  INSERT INTO public.messages (chat_id, sender_id, body)
  VALUES (NEW.chat_id, bot_row.id, reply);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_bot_auto_reply ON public.messages;
CREATE TRIGGER messages_bot_auto_reply
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bot_auto_reply();

INSERT INTO public.profiles (username, display_name, bio, is_bot)
VALUES
  ('helper_bot', 'Помощник', 'Отвечает на сообщения. Команды: /start, /help, /time', true),
  ('echo_bot', 'Эхо', 'Повторяет ваши сообщения', true)
ON CONFLICT (username) DO NOTHING;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name, bio) ON public.profiles TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.contacts TO authenticated;
GRANT SELECT ON public.chats TO authenticated;
GRANT SELECT ON public.chat_members TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;

DROP POLICY IF EXISTS "select_profiles" ON public.profiles;
CREATE POLICY "select_profiles" ON public.profiles FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE
TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "select_own_contacts" ON public.contacts;
CREATE POLICY "select_own_contacts" ON public.contacts FOR SELECT
TO authenticated USING (owner_id = public.current_profile_id());

DROP POLICY IF EXISTS "insert_own_contacts" ON public.contacts;
CREATE POLICY "insert_own_contacts" ON public.contacts FOR INSERT
TO authenticated WITH CHECK (owner_id = public.current_profile_id());

DROP POLICY IF EXISTS "delete_own_contacts" ON public.contacts;
CREATE POLICY "delete_own_contacts" ON public.contacts FOR DELETE
TO authenticated USING (owner_id = public.current_profile_id());

DROP POLICY IF EXISTS "select_member_chats" ON public.chats;
CREATE POLICY "select_member_chats" ON public.chats FOR SELECT
TO authenticated USING (public.is_chat_member(id));

DROP POLICY IF EXISTS "select_member_chat_members" ON public.chat_members;
CREATE POLICY "select_member_chat_members" ON public.chat_members FOR SELECT
TO authenticated USING (public.is_chat_member(chat_id));

DROP POLICY IF EXISTS "select_member_messages" ON public.messages;
CREATE POLICY "select_member_messages" ON public.messages FOR SELECT
TO authenticated USING (public.is_chat_member(chat_id));

DROP POLICY IF EXISTS "insert_member_messages" ON public.messages;
CREATE POLICY "insert_member_messages" ON public.messages FOR INSERT
TO authenticated WITH CHECK (sender_id = public.current_profile_id() AND public.is_chat_member(chat_id));

DROP POLICY IF EXISTS "delete_own_messages" ON public.messages;
CREATE POLICY "delete_own_messages" ON public.messages FOR DELETE
TO authenticated USING (sender_id = public.current_profile_id());

REVOKE EXECUTE ON FUNCTION public.current_profile_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_chat_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.open_direct_chat(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_username_available(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bot_auto_reply() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_direct_chat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;



-- ============================================================
-- MIGRATION: 20261031202757_add_profile_avatar_premium_and_column_grants.sql
-- ============================================================

/*
# Profile avatars, premium flag, and locked-down profile writes

## What changes
1. New column `avatar_url` on profiles: public link to the user's picture (empty when none).
2. New column `is_premium` on profiles: paid-plan flag. Users cannot change it themselves.
3. New public storage bucket `avatars` where profile pictures are stored.
4. Profiles write access is narrowed to the fields a user may edit.

## Security
- Profiles: anon loses all table privileges (it has no policies anyway). Authenticated loses table-wide INSERT/UPDATE/DELETE and gets UPDATE only on: username, display_name, bio, avatar_url, who_can_message, notify_messages, notify_previews. is_premium, is_bot, user_id and id are not writable from the app.
- Avatars bucket: authenticated users can upload, replace and delete only files inside their own folder, named by their profile id. Reading is public through the bucket URL.

## Notes
- Files are stored as `<profile_id>/<file>`; the folder name must equal the caller's profile id.
- is_premium is set by server-side tooling only (payments), never from the app.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS who_can_message text NOT NULL DEFAULT 'everyone';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_messages boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_previews boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_who_can_message_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_who_can_message_check
      CHECK (who_can_message IN ('everyone', 'contacts'));
  END IF;
END $$;

REVOKE ALL ON profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON profiles FROM authenticated;
GRANT SELECT ON profiles TO authenticated;
GRANT UPDATE (username, display_name, bio, avatar_url, who_can_message, notify_messages, notify_previews)
  ON profiles TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "insert_own_avatar_files" ON storage.objects;
CREATE POLICY "insert_own_avatar_files" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = current_profile_id()::text
);

DROP POLICY IF EXISTS "update_own_avatar_files" ON storage.objects;
CREATE POLICY "update_own_avatar_files" ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = current_profile_id()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = current_profile_id()::text
);

DROP POLICY IF EXISTS "delete_own_avatar_files" ON storage.objects;
CREATE POLICY "delete_own_avatar_files" ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = current_profile_id()::text
);



-- ============================================================
-- MIGRATION: 20261031204612_add_chat_settings_replies_and_wallpapers.sql
-- ============================================================

/*
# Account name parts, privacy setting, per-user app settings, message replies, wallpapers

## What changes
1. profiles.last_name: the user's last name (shown next to the first name).
2. profiles.last_seen_visibility: who can see the user's last visit time (everyone / contacts / nobody).
3. New table user_settings: one row per user with birth date (private) and app preferences (text size, colors, wallpaper, notification toggles).
4. messages.reply_to_id: links a message to the message it answers.
5. New public storage bucket `wallpapers` for chat backgrounds picked from the gallery.

## Security
- user_settings is readable and writable only by its owner (row belongs to current_profile_id()). Birth date is therefore never visible to other users.
- profiles: authenticated users may update last_name and last_seen_visibility, in addition to the fields granted earlier.
- wallpapers bucket: uploads and deletes only inside the caller's own folder (named by profile id); reading is public through the bucket URL.

## Notes
- All statements are idempotent and safe to re-run.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name text NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_visibility text NOT NULL DEFAULT 'everyone';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_last_seen_visibility_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_last_seen_visibility_check
      CHECK (last_seen_visibility IN ('everyone', 'contacts', 'nobody'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_last_name_length'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_last_name_length
      CHECK (char_length(last_name) <= 64);
  END IF;
END $$;

GRANT UPDATE (last_name, last_seen_visibility) ON profiles TO authenticated;

CREATE TABLE IF NOT EXISTS user_settings (
  profile_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  birth_date date,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON user_settings TO authenticated;

DROP POLICY IF EXISTS "select_own_user_settings" ON user_settings;
CREATE POLICY "select_own_user_settings" ON user_settings FOR SELECT
TO authenticated
USING (profile_id = current_profile_id());

DROP POLICY IF EXISTS "insert_own_user_settings" ON user_settings;
CREATE POLICY "insert_own_user_settings" ON user_settings FOR INSERT
TO authenticated
WITH CHECK (profile_id = current_profile_id());

DROP POLICY IF EXISTS "update_own_user_settings" ON user_settings;
CREATE POLICY "update_own_user_settings" ON user_settings FOR UPDATE
TO authenticated
USING (profile_id = current_profile_id())
WITH CHECK (profile_id = current_profile_id());

ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS messages_reply_to_id_idx ON messages(reply_to_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('wallpapers', 'wallpapers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "insert_own_wallpaper_files" ON storage.objects;
CREATE POLICY "insert_own_wallpaper_files" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'wallpapers'
  AND (storage.foldername(name))[1] = current_profile_id()::text
);

DROP POLICY IF EXISTS "update_own_wallpaper_files" ON storage.objects;
CREATE POLICY "update_own_wallpaper_files" ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'wallpapers'
  AND (storage.foldername(name))[1] = current_profile_id()::text
)
WITH CHECK (
  bucket_id = 'wallpapers'
  AND (storage.foldername(name))[1] = current_profile_id()::text
);

DROP POLICY IF EXISTS "delete_own_wallpaper_files" ON storage.objects;
CREATE POLICY "delete_own_wallpaper_files" ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'wallpapers'
  AND (storage.foldername(name))[1] = current_profile_id()::text
);



-- ============================================================
-- MIGRATION: 20261031212128_add_devices_table.sql
-- ============================================================

/*
# Add devices table for active sessions

1. New Tables
- `devices`: one row per signed-in device of a profile.
  - `id` (uuid, primary key)
  - `profile_id` (uuid, owner profile, cascades on profile delete)
  - `device_token` (text, random secret generated by the device itself, unique per profile)
  - `name` (text, device model, e.g. "iPhone" or "Samsung SM-S911B")
  - `platform` (text, one of android, iphone, web)
  - `city` (text, approximate city derived from the device time zone)
  - `last_active_at` (timestamptz, updated by a heartbeat while the app is open)
  - `created_at` (timestamptz)

2. Security
- Row level security is enabled. Only the owning profile can read, add, update or remove its devices.
- Authenticated users get SELECT, INSERT, DELETE and column-limited UPDATE. Anonymous users get nothing.

3. Notes
- Removing a device row signs that device out the next time its heartbeat runs.
*/

CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_token text NOT NULL,
  name text NOT NULL DEFAULT '',
  platform text NOT NULL DEFAULT 'web' CHECK (platform IN ('android', 'iphone', 'web')),
  city text NOT NULL DEFAULT '',
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, device_token)
);

CREATE INDEX IF NOT EXISTS devices_profile_last_active_idx ON devices (profile_id, last_active_at);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON devices TO authenticated;
GRANT UPDATE (last_active_at, name, platform, city) ON devices TO authenticated;

DROP POLICY IF EXISTS "select_own_devices" ON devices;
CREATE POLICY "select_own_devices" ON devices FOR SELECT
  TO authenticated USING (profile_id = current_profile_id());

DROP POLICY IF EXISTS "insert_own_devices" ON devices;
CREATE POLICY "insert_own_devices" ON devices FOR INSERT
  TO authenticated WITH CHECK (profile_id = current_profile_id());

DROP POLICY IF EXISTS "update_own_devices" ON devices;
CREATE POLICY "update_own_devices" ON devices FOR UPDATE
  TO authenticated USING (profile_id = current_profile_id()) WITH CHECK (profile_id = current_profile_id());

DROP POLICY IF EXISTS "delete_own_devices" ON devices;
CREATE POLICY "delete_own_devices" ON devices FOR DELETE
  TO authenticated USING (profile_id = current_profile_id());



-- ============================================================
-- MIGRATION: 20261031212401_add_sticker_packs_and_favorites.sql
-- ============================================================

/*
# Add sticker packs, stickers, favorites and sticker messages

1. New Tables
- `sticker_packs`: a named set of stickers owned by a profile.
  - `title` (text, 1 to 64 characters), `is_public` (boolean; public packs are visible to everyone and can be saved by others).
- `stickers`: one image inside a pack (`image_url`, must be an https link to the stickers storage bucket).
- `sticker_favorites`: stickers a profile added to its Favorites.
- `sticker_pack_saves`: public packs a profile saved to its collection.
- `messages.sticker_url`: optional sticker image on a message (empty body).

2. Storage
- Public `stickers` bucket. Files are stored in a folder named after the owner profile; only that owner can upload or delete them.

3. Security
- Row level security is enabled on every new table.
- Pack owners manage their packs and stickers. Everyone can read their own packs plus public packs.
- Favorites and saved packs belong to the profile that created them.
- Only authenticated users get privileges, limited to the verbs the app uses.

4. Notes
- The sticker_url check accepts only links to this project's stickers bucket.
*/

CREATE TABLE IF NOT EXISTS sticker_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 64),
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES sticker_packs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_url text NOT NULL CHECK (image_url ~ '^https://.+/storage/v1/object/public/stickers/.+'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stickers_pack_idx ON stickers (pack_id);
CREATE INDEX IF NOT EXISTS sticker_packs_owner_idx ON sticker_packs (owner_id);

CREATE TABLE IF NOT EXISTS sticker_favorites (
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sticker_id uuid NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, sticker_id)
);

CREATE TABLE IF NOT EXISTS sticker_pack_saves (
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES sticker_packs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, pack_id)
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS sticker_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'messages'::regclass AND conname = 'messages_sticker_url_check'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT messages_sticker_url_check
      CHECK (sticker_url IS NULL OR sticker_url ~ '^https://.+/storage/v1/object/public/stickers/.+');
  END IF;
END $$;

ALTER TABLE sticker_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sticker_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE sticker_pack_saves ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE (title, is_public), DELETE ON sticker_packs TO authenticated;
GRANT SELECT, INSERT, DELETE ON stickers TO authenticated;
GRANT SELECT, INSERT, DELETE ON sticker_favorites TO authenticated;
GRANT SELECT, INSERT, DELETE ON sticker_pack_saves TO authenticated;

DROP POLICY IF EXISTS "select_own_or_public_sticker_packs" ON sticker_packs;
CREATE POLICY "select_own_or_public_sticker_packs" ON sticker_packs FOR SELECT
  TO authenticated USING (owner_id = current_profile_id() OR is_public);

DROP POLICY IF EXISTS "insert_own_sticker_packs" ON sticker_packs;
CREATE POLICY "insert_own_sticker_packs" ON sticker_packs FOR INSERT
  TO authenticated WITH CHECK (owner_id = current_profile_id());

DROP POLICY IF EXISTS "update_own_sticker_packs" ON sticker_packs;
CREATE POLICY "update_own_sticker_packs" ON sticker_packs FOR UPDATE
  TO authenticated USING (owner_id = current_profile_id()) WITH CHECK (owner_id = current_profile_id());

DROP POLICY IF EXISTS "delete_own_sticker_packs" ON sticker_packs;
CREATE POLICY "delete_own_sticker_packs" ON sticker_packs FOR DELETE
  TO authenticated USING (owner_id = current_profile_id());

DROP POLICY IF EXISTS "select_visible_stickers" ON stickers;
CREATE POLICY "select_visible_stickers" ON stickers FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM sticker_packs p
      WHERE p.id = stickers.pack_id AND (p.owner_id = current_profile_id() OR p.is_public)
    )
  );

DROP POLICY IF EXISTS "insert_own_stickers" ON stickers;
CREATE POLICY "insert_own_stickers" ON stickers FOR INSERT
  TO authenticated WITH CHECK (
    owner_id = current_profile_id()
    AND EXISTS (SELECT 1 FROM sticker_packs p WHERE p.id = stickers.pack_id AND p.owner_id = current_profile_id())
  );

DROP POLICY IF EXISTS "delete_own_stickers" ON stickers;
CREATE POLICY "delete_own_stickers" ON stickers FOR DELETE
  TO authenticated USING (owner_id = current_profile_id());

DROP POLICY IF EXISTS "select_own_sticker_favorites" ON sticker_favorites;
CREATE POLICY "select_own_sticker_favorites" ON sticker_favorites FOR SELECT
  TO authenticated USING (profile_id = current_profile_id());

DROP POLICY IF EXISTS "insert_own_sticker_favorites" ON sticker_favorites;
CREATE POLICY "insert_own_sticker_favorites" ON sticker_favorites FOR INSERT
  TO authenticated WITH CHECK (profile_id = current_profile_id());

DROP POLICY IF EXISTS "delete_own_sticker_favorites" ON sticker_favorites;
CREATE POLICY "delete_own_sticker_favorites" ON sticker_favorites FOR DELETE
  TO authenticated USING (profile_id = current_profile_id());

DROP POLICY IF EXISTS "select_own_pack_saves" ON sticker_pack_saves;
CREATE POLICY "select_own_pack_saves" ON sticker_pack_saves FOR SELECT
  TO authenticated USING (profile_id = current_profile_id());

DROP POLICY IF EXISTS "insert_own_pack_saves" ON sticker_pack_saves;
CREATE POLICY "insert_own_pack_saves" ON sticker_pack_saves FOR INSERT
  TO authenticated WITH CHECK (
    profile_id = current_profile_id()
    AND EXISTS (SELECT 1 FROM sticker_packs p WHERE p.id = sticker_pack_saves.pack_id AND p.is_public)
  );

DROP POLICY IF EXISTS "delete_own_pack_saves" ON sticker_pack_saves;
CREATE POLICY "delete_own_pack_saves" ON sticker_pack_saves FOR DELETE
  TO authenticated USING (profile_id = current_profile_id());

INSERT INTO storage.buckets (id, name, public)
VALUES ('stickers', 'stickers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "stickers_upload_own_folder" ON storage.objects;
CREATE POLICY "stickers_upload_own_folder" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'stickers' AND (storage.foldername(name))[1] = current_profile_id()::text);

DROP POLICY IF EXISTS "stickers_delete_own_folder" ON storage.objects;
CREATE POLICY "stickers_delete_own_folder" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'stickers' AND (storage.foldername(name))[1] = current_profile_id()::text);



-- ============================================================
-- MIGRATION: 20261031213302_add_device_login_tokens.sql
-- ============================================================

/*
# Add QR device login tokens

1. New Tables
- `device_login_tokens`: short-lived login tokens shown as a QR code on a signed-in phone.
  - `profile_id` (owner profile), `token_hash` (SHA-256 of the token; the raw token is never stored),
    `expires_at` (5 minutes after creation), `used_at` (set once the token has been redeemed).

2. New Functions
- `create_device_login_token()`: creates a token for the calling profile and returns the raw token once.
  Older expired tokens of the caller are cleaned up at the same time.

3. Security
- Row level security is enabled. Users can only see and insert their own tokens.
- Users cannot update or delete tokens directly; redemption happens in a server function with service rights.
- The token function is callable only by signed-in users.

4. Notes
- Tokens are 64 hex characters from two random UUIDs, which makes guessing impractical.
*/

CREATE TABLE IF NOT EXISTS device_login_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS device_login_tokens_profile_idx ON device_login_tokens (profile_id, created_at);

ALTER TABLE device_login_tokens ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON device_login_tokens TO authenticated;

DROP POLICY IF EXISTS "select_own_device_login_tokens" ON device_login_tokens;
CREATE POLICY "select_own_device_login_tokens" ON device_login_tokens FOR SELECT
  TO authenticated USING (profile_id = current_profile_id());

DROP POLICY IF EXISTS "insert_own_device_login_tokens" ON device_login_tokens;
CREATE POLICY "insert_own_device_login_tokens" ON device_login_tokens FOR INSERT
  TO authenticated WITH CHECK (profile_id = current_profile_id());

CREATE OR REPLACE FUNCTION create_device_login_token()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_profile uuid := current_profile_id();
BEGIN
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;

  DELETE FROM device_login_tokens
  WHERE profile_id = v_profile AND expires_at < now() - interval '1 hour';

  INSERT INTO device_login_tokens (profile_id, token_hash, expires_at)
  VALUES (
    v_profile,
    encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
    now() + interval '5 minutes'
  );

  RETURN v_token;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_device_login_token() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_device_login_token() TO authenticated;



-- ============================================================
-- MIGRATION: 20261031213316_grant_device_login_token_cleanup.sql
-- ============================================================

/*
# Allow owners to delete their own expired device login tokens

1. Security
- Grants DELETE on `device_login_tokens` to `authenticated`.
- Adds an owner-only DELETE policy, so the token cleanup in `create_device_login_token()` works for the calling user.
*/

GRANT DELETE ON device_login_tokens TO authenticated;

DROP POLICY IF EXISTS "delete_own_device_login_tokens" ON device_login_tokens;
CREATE POLICY "delete_own_device_login_tokens" ON device_login_tokens FOR DELETE
  TO authenticated USING (profile_id = current_profile_id());



-- ============================================================
-- MIGRATION: 20261031215444_allow_sticker_messages_without_text.sql
-- ============================================================

/*
# Allow sticker messages with an empty text body

1. Changes
- Replaces the message text length rule: text must be 1 to 4000 characters, unless the message carries a sticker.

2. Notes
- Existing messages keep their text. Only the rule that rejected empty text is changed.
*/

DO $$
DECLARE
  body_constraint text;
BEGIN
  SELECT conname INTO body_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.messages'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%char_length(body)%';
  IF body_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.messages DROP CONSTRAINT %I', body_constraint);
  END IF;
END $$;

ALTER TABLE messages ADD CONSTRAINT messages_body_check
  CHECK (char_length(body) <= 4000 AND (char_length(body) >= 1 OR sticker_url IS NOT NULL));



-- ============================================================
-- MIGRATION: 20261031215940_add_message_reactions_and_media.sql
-- ============================================================

/*
# Message reactions and voice or video-circle media

1. New Tables
- `message_reactions`: one emoji reaction per person per message. Allowed emojis are a fixed set.

2. Changes to messages
- `media_url` (link to an audio or video file in the chat-media bucket) and `media_kind` ('voice' or 'circle').
- The text rule now allows an empty text when a sticker or media is attached.

3. Storage
- Public `chat-media` bucket. Files are stored in a folder named after the sender profile; only that sender can upload or delete them.

4. Security
- Reactions can be read, added and removed only by members of the chat the message belongs to.
- Row level security is enabled. Only signed-in users get privileges.
*/

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('👍', '❤️', '😂', '😮', '😢', '🙏')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, profile_id, emoji)
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON message_reactions TO authenticated;

DROP POLICY IF EXISTS "select_chat_reactions" ON message_reactions;
CREATE POLICY "select_chat_reactions" ON message_reactions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM messages m WHERE m.id = message_reactions.message_id AND is_chat_member(m.chat_id))
  );

DROP POLICY IF EXISTS "insert_own_chat_reactions" ON message_reactions;
CREATE POLICY "insert_own_chat_reactions" ON message_reactions FOR INSERT
  TO authenticated WITH CHECK (
    profile_id = current_profile_id()
    AND EXISTS (SELECT 1 FROM messages m WHERE m.id = message_reactions.message_id AND is_chat_member(m.chat_id))
  );

DROP POLICY IF EXISTS "delete_own_chat_reactions" ON message_reactions;
CREATE POLICY "delete_own_chat_reactions" ON message_reactions FOR DELETE
  TO authenticated USING (profile_id = current_profile_id());

ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_kind text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'messages'::regclass AND conname = 'messages_media_check') THEN
    ALTER TABLE messages ADD CONSTRAINT messages_media_check CHECK (
      (media_url IS NULL AND media_kind IS NULL)
      OR (media_url ~ '^https://.+/storage/v1/object/public/chat-media/.+' AND media_kind IN ('voice', 'circle'))
    );
  END IF;
END $$;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_body_check;
ALTER TABLE messages ADD CONSTRAINT messages_body_check
  CHECK (
    char_length(body) <= 4000
    AND (char_length(body) >= 1 OR sticker_url IS NOT NULL OR media_url IS NOT NULL)
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat_media_upload_own_folder" ON storage.objects;
CREATE POLICY "chat_media_upload_own_folder" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = current_profile_id()::text);

DROP POLICY IF EXISTS "chat_media_delete_own_folder" ON storage.objects;
CREATE POLICY "chat_media_delete_own_folder" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = current_profile_id()::text);



-- ============================================================
-- MIGRATION: 20261031221112_add_chat_reads.sql
-- ============================================================

/*
# Add per-member read tracking for chats

1. New Tables
- `chat_reads`: one row per chat member saying when they last read the chat.
  - `chat_id` (uuid, references chats, part of the primary key)
  - `profile_id` (uuid, references profiles, part of the primary key)
  - `last_read_at` (timestamptz, defaults to now)

2. Security
- Row level security is enabled on `chat_reads`.
- Members of a chat can read everyone's read marker in that chat, so each side can show "seen".
- A member can only insert or update their own marker, and only in chats they belong to.
- Access is granted to the `authenticated` role only.

3. Realtime
- `chat_reads` is added to the realtime publication so the other side sees "seen" without reloading.

4. Notes
- Existing data is untouched; the table starts empty and markers are created the first time a member opens a chat.
*/

CREATE TABLE IF NOT EXISTS chat_reads (
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, profile_id)
);

ALTER TABLE chat_reads ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON chat_reads TO authenticated;

DROP POLICY IF EXISTS "select_chat_reads" ON chat_reads;
CREATE POLICY "select_chat_reads" ON chat_reads FOR SELECT
  TO authenticated USING (is_chat_member(chat_id));

DROP POLICY IF EXISTS "insert_own_chat_reads" ON chat_reads;
CREATE POLICY "insert_own_chat_reads" ON chat_reads FOR INSERT
  TO authenticated WITH CHECK (profile_id = current_profile_id() AND is_chat_member(chat_id));

DROP POLICY IF EXISTS "update_own_chat_reads" ON chat_reads;
CREATE POLICY "update_own_chat_reads" ON chat_reads FOR UPDATE
  TO authenticated
  USING (profile_id = current_profile_id() AND is_chat_member(chat_id))
  WITH CHECK (profile_id = current_profile_id() AND is_chat_member(chat_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_reads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_reads;
  END IF;
END $$;



-- ============================================================
-- MIGRATION: 20261031235930_add_message_edit_and_hide_for_me.sql
-- ============================================================

/*
# Message editing and per-user hiding

1. Changes to messages
- `edited_at` (timestamptz, nullable): set when the sender edits the text of a message.

2. New Tables
- `hidden_messages`: one row per profile per message that the profile deleted "for me".
  - `profile_id` (owner profile), `message_id` (message hidden for that profile), `created_at`.
  - Primary key (profile_id, message_id).

3. Security
- Senders can update their own messages (text and edited_at only). Peers cannot change messages.
- hidden_messages is readable, insertable and deletable only by its owner profile.
- Deleting a message for everyone still uses the existing sender-only delete policy.

4. Notes
- Hiding a message never deletes it for the other participant.
*/

ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

GRANT UPDATE (body, edited_at) ON messages TO authenticated;

DROP POLICY IF EXISTS "update_own_messages" ON messages;
CREATE POLICY "update_own_messages" ON messages FOR UPDATE
  TO authenticated
  USING (sender_id = current_profile_id())
  WITH CHECK (sender_id = current_profile_id() AND is_chat_member(chat_id));

CREATE TABLE IF NOT EXISTS hidden_messages (
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, message_id)
);

ALTER TABLE hidden_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON hidden_messages TO authenticated;

DROP POLICY IF EXISTS "select_own_hidden_messages" ON hidden_messages;
CREATE POLICY "select_own_hidden_messages" ON hidden_messages FOR SELECT
  TO authenticated USING (profile_id = current_profile_id());

DROP POLICY IF EXISTS "insert_own_hidden_messages" ON hidden_messages;
CREATE POLICY "insert_own_hidden_messages" ON hidden_messages FOR INSERT
  TO authenticated WITH CHECK (
    profile_id = current_profile_id()
    AND EXISTS (SELECT 1 FROM messages m WHERE m.id = hidden_messages.message_id AND is_chat_member(m.chat_id))
  );

DROP POLICY IF EXISTS "delete_own_hidden_messages" ON hidden_messages;
CREATE POLICY "delete_own_hidden_messages" ON hidden_messages FOR DELETE
  TO authenticated USING (profile_id = current_profile_id());



-- ============================================================
-- MIGRATION: 20261101000452_add_profile_photo_history.sql
-- ============================================================

/*
# Profile photo history

1. New Tables
- `profile_photos`: every profile picture a user has ever set.
  - `id` (uuid, primary key), `profile_id` (owner profile), `image_url` (public photo link), `created_at`.

2. Automatic recording
- A trigger on `profiles` adds a row to `profile_photos` whenever `avatar_url` changes to a non-empty value.
- Existing profile pictures are copied into the history once when this migration runs.

3. Security
- Row level security is enabled on `profile_photos`.
- Any signed-in user can read photo history, the same way profiles are already visible to everyone.
- A user can only add history rows for their own profile. Rows cannot be edited or deleted from the app.

4. Notes
- Removing the current picture keeps earlier photos in the history.
*/

CREATE TABLE IF NOT EXISTS profile_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_photos_profile_created_idx ON profile_photos (profile_id, created_at DESC);

ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON profile_photos TO authenticated;

DROP POLICY IF EXISTS "select_profile_photos" ON profile_photos;
CREATE POLICY "select_profile_photos" ON profile_photos FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_profile_photos" ON profile_photos;
CREATE POLICY "insert_own_profile_photos" ON profile_photos FOR INSERT
  TO authenticated WITH CHECK (profile_id = current_profile_id());

INSERT INTO profile_photos (profile_id, image_url, created_at)
SELECT p.id, p.avatar_url, now()
FROM profiles p
WHERE COALESCE(p.avatar_url, '') <> ''
  AND NOT EXISTS (SELECT 1 FROM profile_photos pp WHERE pp.profile_id = p.id AND pp.image_url = p.avatar_url);

CREATE OR REPLACE FUNCTION record_profile_avatar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.avatar_url, '') <> '' AND NEW.avatar_url IS DISTINCT FROM OLD.avatar_url THEN
    INSERT INTO profile_photos (profile_id, image_url) VALUES (NEW.id, NEW.avatar_url);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_profile_avatar_trigger ON profiles;
CREATE TRIGGER record_profile_avatar_trigger
  AFTER UPDATE OF avatar_url ON profiles
  FOR EACH ROW EXECUTE FUNCTION record_profile_avatar();



-- ============================================================
-- MIGRATION: 20261101160000_social_features_setup.sql
-- ============================================================

-- СОЦИАЛЬНЫЕ ФУНКЦИИ: посты, лайки, комментарии и истории.
-- Запустите ВЕСЬ файл один раз в Supabase -> SQL Editor -> New query -> Run.
-- Скрипт можно безопасно запускать повторно: он не удаляет записи пользователей.
-- Он рассчитан на существующую базу проекта с public.profiles и public.current_profile_id().

begin;

-- Функция возвращает внутренний ID профиля текущего авторизованного пользователя.
-- В этом проекте profiles.id отличается от auth.uid().
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles as p
  where p.user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_profile_id() from public, anon;
grant execute on function public.current_profile_id() to authenticated;

-- ИСТОРИИ. Если таблица уже есть, добавляем недостающую колонку audio_url.
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  image_url text not null,
  caption text not null default '' check (char_length(caption) <= 300),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  audio_url text
);

alter table public.stories add column if not exists audio_url text;
create index if not exists stories_profile_created_idx
  on public.stories (profile_id, created_at desc);

alter table public.stories enable row level security;
grant select, insert, delete on public.stories to authenticated;

drop policy if exists "select_active_or_own_stories" on public.stories;
create policy "select_active_or_own_stories"
  on public.stories for select to authenticated
  using (profile_id = public.current_profile_id() or expires_at > now());

drop policy if exists "insert_own_stories" on public.stories;
create policy "insert_own_stories"
  on public.stories for insert to authenticated
  with check (profile_id = public.current_profile_id());

drop policy if exists "delete_own_stories" on public.stories;
create policy "delete_own_stories"
  on public.stories for delete to authenticated
  using (profile_id = public.current_profile_id());

-- ПОСТЫ.
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  media_url text,
  media_type text check (media_type in ('image', 'video') or media_type is null),
  created_at timestamptz not null default now(),
  constraint posts_content_or_media
    check (length(trim(content)) > 0 or media_url is not null)
);

-- На случай, если таблица posts уже была создана в неполном виде.
alter table public.posts add column if not exists content text not null default '';
alter table public.posts add column if not exists media_url text;
alter table public.posts add column if not exists media_type text;
alter table public.posts add column if not exists created_at timestamptz not null default now();
create index if not exists posts_created_at_idx on public.posts (created_at desc);

alter table public.posts enable row level security;
grant select, insert, delete on public.posts to authenticated;

drop policy if exists "Authenticated users can read posts" on public.posts;
create policy "Authenticated users can read posts"
  on public.posts for select to authenticated using (true);

drop policy if exists "Users can create own posts" on public.posts;
create policy "Users can create own posts"
  on public.posts for insert to authenticated
  with check (profile_id = public.current_profile_id());

drop policy if exists "Users can delete own posts" on public.posts;
create policy "Users can delete own posts"
  on public.posts for delete to authenticated
  using (profile_id = public.current_profile_id());

-- ЛАЙКИ.
create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

alter table public.post_likes enable row level security;
grant select, insert, delete on public.post_likes to authenticated;

drop policy if exists "Read post likes" on public.post_likes;
create policy "Read post likes"
  on public.post_likes for select to authenticated using (true);

drop policy if exists "Like as own profile" on public.post_likes;
create policy "Like as own profile"
  on public.post_likes for insert to authenticated
  with check (profile_id = public.current_profile_id());

drop policy if exists "Unlike as own profile" on public.post_likes;
create policy "Unlike as own profile"
  on public.post_likes for delete to authenticated
  using (profile_id = public.current_profile_id());

-- КОММЕНТАРИИ.
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_created_idx
  on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;
grant select, insert, delete on public.post_comments to authenticated;

drop policy if exists "Read post comments" on public.post_comments;
create policy "Read post comments"
  on public.post_comments for select to authenticated using (true);

drop policy if exists "Create own post comments" on public.post_comments;
create policy "Create own post comments"
  on public.post_comments for insert to authenticated
  with check (profile_id = public.current_profile_id());

drop policy if exists "Delete own post comments" on public.post_comments;
create policy "Delete own post comments"
  on public.post_comments for delete to authenticated
  using (profile_id = public.current_profile_id());

-- ХРАНИЛИЩА ФОТО, ВИДЕО И АУДИО.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stories', 'stories', true, 52428800,
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime','audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav','audio/webm']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media', 'post-media', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view post media" on storage.objects;
create policy "Public can view post media"
  on storage.objects for select
  using (bucket_id in ('post-media', 'stories'));

drop policy if exists "Users upload own post media" on storage.objects;
create policy "Users upload own post media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('post-media', 'stories')
    and (storage.foldername(name))[1] = public.current_profile_id()::text
  );

drop policy if exists "Users delete own post media" on storage.objects;
create policy "Users delete own post media"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('post-media', 'stories')
    and (storage.foldername(name))[1] = public.current_profile_id()::text
  );

commit;

