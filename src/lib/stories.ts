import { supabase } from '@/lib/supabase';
import { uploadStoryMedia } from '@/lib/storage';
import type { Story } from '@/lib/types';

const STORY_COLUMNS = 'id, profile_id, image_url, audio_url, caption, created_at, expires_at';
const STORY_BUCKET = 'stories';
const ARCHIVE_LIMIT = 200;

export async function fetchActiveStories(profileId: string): Promise<Story[]> {
  const { data, error } = await supabase
    .from('stories')
    .select(STORY_COLUMNS)
    .eq('profile_id', profileId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true });
  if (error || !data) throw new Error(error ? `Не удалось загрузить истории: ${error.message}${error.code ? ` (${error.code})` : ''}. Проверьте SUPABASE_SETUP.sql.` : 'Не удалось загрузить истории.');
  return data as Story[];
}

export async function fetchArchivedStories(profileId: string): Promise<Story[]> {
  const { data, error } = await supabase
    .from('stories')
    .select(STORY_COLUMNS)
    .eq('profile_id', profileId)
    .lte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(ARCHIVE_LIMIT);
  if (error || !data) throw new Error(error ? `Не удалось загрузить архив: ${error.message}${error.code ? ` (${error.code})` : ''}. Проверьте SUPABASE_SETUP.sql.` : 'Не удалось загрузить архив.');
  return data as Story[];
}

export async function publishStory(profileId: string, file: File, caption: string, audioFile?: File | null): Promise<void> {
  const imageUrl = await uploadStoryMedia(profileId, file);
  const audioUrl = audioFile ? await uploadStoryMedia(profileId, audioFile) : null;
  const { error } = await supabase
    .from('stories')
    .insert({ profile_id: profileId, image_url: imageUrl, audio_url: audioUrl, caption: caption.trim() });
  if (error) throw new Error(`Не удалось сохранить историю: ${error.message}${error.code ? ` (${error.code})` : ''}. Проверьте SUPABASE_SETUP.sql.`);
}

export async function deleteStory(story: Story): Promise<void> {
  const { error } = await supabase.from('stories').delete().eq('id', story.id);
  if (error) throw new Error('Не удалось удалить историю');

  const paths = [story.image_url, story.audio_url].filter((url): url is string => Boolean(url)).map(url => url.split(`/object/public/${STORY_BUCKET}/`)[1]).filter(Boolean);
  if (paths.length) await supabase.storage.from(STORY_BUCKET).remove(paths);
}
