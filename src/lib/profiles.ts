import { supabase } from '@/lib/supabase';
import { parsePreferences, type Preferences } from '@/lib/preferences';
import { PROFILE_COLUMNS, type MyProfile, type Profile, type ProfilePatch, type ProfilePhoto } from '@/lib/types';

export async function loadMyProfile(userId: string): Promise<MyProfile | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('Не удалось загрузить профиль');
  if (!profile) return null;

  const mine = profile as Profile;
  const { data: settings, error: settingsError } = await supabase
    .from('user_settings')
    .select('birth_date, preferences')
    .eq('profile_id', mine.id)
    .maybeSingle();
  if (settingsError) throw new Error('Не удалось загрузить настройки');

  return {
    ...mine,
    birth_date: (settings?.birth_date as string | null | undefined) ?? null,
    preferences: parsePreferences(settings?.preferences),
  };
}

export async function saveMyPreferences(profileId: string, preferences: Preferences): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ profile_id: profileId, preferences, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' });
  if (error) throw new Error('Не удалось сохранить настройку.');
}

export async function saveBirthDate(profileId: string, birthDate: string | null): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ profile_id: profileId, birth_date: birthDate, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' });
  if (error) throw new Error('Не удалось сохранить дату рождения.');
}

export async function openDirectChat(profileId: string): Promise<string> {
  const { data, error } = await supabase.rpc('open_direct_chat', { p_other_profile_id: profileId });
  if (error || typeof data !== 'string') {
    throw new Error('Не удалось открыть чат');
  }
  return data;
}

export async function searchProfiles(term: string, myProfileId: string): Promise<Profile[]> {
  const cleaned = term.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!cleaned) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .ilike('username', `%${cleaned}%`)
    .neq('id', myProfileId)
    .order('username', { ascending: true })
    .limit(20);

  if (error || !data) throw new Error('Поиск недоступен');
  return data as Profile[];
}

export async function fetchBots(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('is_bot', true)
    .order('username', { ascending: true });

  if (error || !data) throw new Error('Не удалось загрузить ботов');
  return data as Profile[];
}

export async function updateProfile(profileId: string, patch: ProfilePatch): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', profileId)
    .select(PROFILE_COLUMNS)
    .maybeSingle();

  if (error?.code === '23505') throw new Error('Это имя пользователя уже занято');
  if (error || !data) throw new Error('Не удалось сохранить. Попробуйте еще раз.');
  return data as Profile;
}

export async function fetchProfilePhotos(profileId: string): Promise<ProfilePhoto[]> {
  const { data, error } = await supabase
    .from('profile_photos')
    .select('id, image_url, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data) throw new Error('Не удалось загрузить фото');
  return data as ProfilePhoto[];
}

export async function isUsernameFree(username: string, currentUsername: string): Promise<boolean> {
  if (username === currentUsername) return true;
  const { data, error } = await supabase.rpc('is_username_available', { p_username: username });
  if (error || typeof data !== 'boolean') throw new Error('Не удалось проверить имя пользователя');
  return data;
}
