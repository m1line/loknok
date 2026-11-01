import { useCallback, useEffect, useState } from 'react';
import { Heart, ImagePlus, Loader2, MessageCircle, MoreHorizontal, Newspaper, Send, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MyProfile } from '@/lib/types';

type Author = { display_name: string; username: string; avatar_url: string | null };
type Post = { id: string; profile_id: string; content: string; media_url: string | null; media_type: string | null; created_at: string; author?: Author; likes_count: number; liked: boolean; comments_count: number };
type Comment = { id: string; post_id: string; profile_id: string; content: string; created_at: string; author?: Author };
const fallbackAuthor: Author = { display_name: 'Пользователь', username: '', avatar_url: null };

function errorText(error: { message?: string; code?: string } | null, action: string) {
  if (!error) return '';
  if (error.code === '42P01' || error.code === 'PGRST205') return `Не найдена таблица для раздела «${action}». Откройте файл SUPABASE_SETUP.sql и выполните его в Supabase → SQL Editor.`;
  if (error.code === '42501' || error.code === 'PGRST301') return `Нет доступа для действия «${action}». Проверьте политики доступа в Supabase (SUPABASE_SETUP.sql).`;
  return `${action}: ${error.message || 'неизвестная ошибка'}${error.code ? ` (${error.code})` : ''}`;
}

export default function PostsScreen({ profile }: { profile: MyProfile }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [busyLikes, setBusyLikes] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: queryError } = await supabase.from('posts').select('id,profile_id,content,media_url,media_type,created_at').order('created_at', { ascending: false }).limit(50);
    if (queryError) { setError(errorText(queryError, 'Загрузка ленты')); setLoading(false); return; }
    const rows = data ?? [];
    const ids = [...new Set(rows.map(row => row.profile_id))];
    const [{ data: people, error: peopleError }, { data: likeRows, error: likesError }, { data: commentRows, error: commentsError }] = await Promise.all([
      ids.length ? supabase.from('profiles').select('id,display_name,username,avatar_url').in('id', ids) : Promise.resolve({ data: [], error: null }),
      supabase.from('post_likes').select('post_id,profile_id').in('post_id', rows.map(row => row.id)),
      supabase.from('post_comments').select('post_id').in('post_id', rows.map(row => row.id)),
    ]);
    if (peopleError || likesError || commentsError) {
      const err = peopleError || likesError || commentsError;
      setError(errorText(err, 'Загрузка реакций и комментариев'));
    }
    const authorMap = new Map((people ?? []).map(person => [person.id, person as Author]));
    setPosts(rows.map(row => {
      const rowLikes = (likeRows ?? []).filter(item => item.post_id === row.id);
      return { ...row, author: authorMap.get(row.profile_id) ?? fallbackAuthor, likes_count: rowLikes.length, liked: rowLikes.some(item => item.profile_id === profile.id), comments_count: (commentRows ?? []).filter(item => item.post_id === row.id).length };
    }));
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { void load(); }, [load]);

  const publish = async () => {
    if ((!content.trim() && !file) || sending) return;
    setSending(true); setError('');
    try {
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;
      if (file) {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) throw new Error('Можно прикрепить фото или видео.');
        if (file.size > 50 * 1024 * 1024) throw new Error('Файл должен быть не больше 50 МБ.');
        const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
        const path = `${profile.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('post-media').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
        if (uploadError) throw new Error(errorText(uploadError, 'Загрузка фото/видео'));
        mediaUrl = supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl;
        mediaType = file.type.startsWith('video/') ? 'video' : 'image';
      }
      const { error: insertError } = await supabase.from('posts').insert({ profile_id: profile.id, content: content.trim(), media_url: mediaUrl, media_type: mediaType });
      if (insertError) throw new Error(errorText(insertError, 'Публикация поста'));
      setContent(''); setFile(null); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Ошибка публикации'); }
    finally { setSending(false); }
  };

  const toggleLike = async (post: Post) => {
    if (busyLikes.includes(post.id)) return;
    setBusyLikes(current => [...current, post.id]);
    const nextLiked = !post.liked;
    setPosts(current => current.map(item => item.id === post.id ? { ...item, liked: nextLiked, likes_count: Math.max(0, item.likes_count + (nextLiked ? 1 : -1)) } : item));
    const result = nextLiked
      ? await supabase.from('post_likes').insert({ post_id: post.id, profile_id: profile.id })
      : await supabase.from('post_likes').delete().eq('post_id', post.id).eq('profile_id', profile.id);
    if (result.error) { setError(errorText(result.error, 'Изменение лайка')); await load(); }
    setBusyLikes(current => current.filter(id => id !== post.id));
  };

  const showComments = async (postId: string) => {
    setOpenComments(postId === openComments ? null : postId);
    if (postId === openComments || comments[postId]) return;
    const { data, error: commentError } = await supabase.from('post_comments').select('id,post_id,profile_id,content,created_at').eq('post_id', postId).order('created_at', { ascending: true });
    if (commentError) { setError(errorText(commentError, 'Загрузка комментариев')); return; }
    const ids = [...new Set((data ?? []).map(item => item.profile_id))];
    const { data: people } = ids.length ? await supabase.from('profiles').select('id,display_name,username,avatar_url').in('id', ids) : { data: [] };
    const authorMap = new Map((people ?? []).map(person => [person.id, person as Author]));
    setComments(current => ({ ...current, [postId]: (data ?? []).map(item => ({ ...item, author: authorMap.get(item.profile_id) ?? fallbackAuthor })) }));
  };

  const addComment = async (postId: string) => {
    if (!commentText.trim() || commentBusy) return;
    setCommentBusy(true);
    const { data, error: insertError } = await supabase.from('post_comments').insert({ post_id: postId, profile_id: profile.id, content: commentText.trim() }).select('id,post_id,profile_id,content,created_at').single();
    if (insertError) setError(errorText(insertError, 'Добавление комментария'));
    else if (data) {
      setComments(current => ({ ...current, [postId]: [...(current[postId] ?? []), { ...data, author: { display_name: profile.display_name, username: profile.username, avatar_url: profile.avatar_url } }] }));
      setPosts(current => current.map(post => post.id === postId ? { ...post, comments_count: post.comments_count + 1 } : post));
      setCommentText('');
    }
    setCommentBusy(false);
  };

  const deleteComment = async (comment: Comment) => {
    const { error: deleteError } = await supabase.from('post_comments').delete().eq('id', comment.id).eq('profile_id', profile.id);
    if (deleteError) { setError(errorText(deleteError, 'Удаление комментария')); return; }
    setComments(current => ({ ...current, [comment.post_id]: (current[comment.post_id] ?? []).filter(item => item.id !== comment.id) }));
    setPosts(current => current.map(post => post.id === comment.post_id ? { ...post, comments_count: Math.max(0, post.comments_count - 1) } : post));
  };

  const deletePost = async (post: Post) => {
    if (!window.confirm('Удалить эту публикацию?')) return;
    const { error: deleteError } = await supabase.from('posts').delete().eq('id', post.id).eq('profile_id', profile.id);
    if (deleteError) setError(errorText(deleteError, 'Удаление поста'));
    else setPosts(current => current.filter(item => item.id !== post.id));
  };

  return <div className="h-full overflow-y-auto bg-[#f0f2f5] px-3 pb-6 pt-4 dark:bg-slate-950 sm:px-5">
    <div className="mx-auto max-w-[680px] space-y-4">
      <header className="flex items-center gap-3 px-1"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e7f3ff] text-[#1877f2]"><Newspaper size={23}/></div><div><h1 className="text-[22px] font-bold text-slate-900 dark:text-white">Новости</h1><p className="text-xs text-slate-500">Публикации и обновления друзей</p></div></header>
      <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="flex items-center gap-3"><div className="h-10 w-10 overflow-hidden rounded-full bg-slate-200 text-center text-sm font-bold leading-10 text-slate-600">{profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover"/> : profile.display_name.slice(0,1).toUpperCase()}</div><p className="font-semibold text-slate-800 dark:text-slate-100">{profile.display_name}, что у вас нового?</p></div>
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={3} placeholder="Что у вас нового?" className="mt-3 w-full resize-none rounded-xl bg-[#f0f2f5] px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-[#1877f2]/20 dark:bg-slate-800 dark:text-white"/>
        {file && <div className="mt-2 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700"><span className="truncate">{file.name}</span><button onClick={() => setFile(null)} className="ml-2 font-bold">Убрать</button></div>}
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800"><label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><ImagePlus size={19} className="text-emerald-600"/>Фото / видео<input type="file" accept="image/*,video/*" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)}/></label><button type="button" onClick={() => void publish()} disabled={sending || (!content.trim() && !file)} className="flex items-center gap-2 rounded-lg bg-[#1877f2] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-40">{sending ? <Loader2 size={15} className="animate-spin"/> : <Send size={15}/>}Опубликовать</button></div>
      </section>
      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{error}</div>}
      {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#1877f2]"/></div> : posts.length === 0 ? <div className="rounded-xl bg-white px-6 py-12 text-center shadow-sm dark:bg-slate-900"><p className="font-semibold text-slate-700 dark:text-slate-200">Пока нет публикаций</p><p className="mt-1 text-xs text-slate-500">Будь первым — поделись чем-нибудь!</p></div> : posts.map(post => <article key={post.id} className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900"><div className="flex items-center gap-3 p-4"><div className="h-10 w-10 overflow-hidden rounded-full bg-slate-200 text-center text-sm font-bold leading-10 text-slate-600 dark:bg-slate-800">{post.author?.avatar_url ? <img src={post.author.avatar_url} alt="" className="h-full w-full object-cover"/> : (post.author?.display_name || 'П').slice(0,1)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800 dark:text-white">{post.author?.display_name || 'Пользователь'}</p><p className="text-[11px] text-slate-400">{new Date(post.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p></div>{post.profile_id === profile.id && <button type="button" onClick={() => void deletePost(post)} title="Удалить пост" className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500"><Trash2 size={17}/></button>}<MoreHorizontal size={18} className="text-slate-400"/></div>{post.content && <p className="whitespace-pre-wrap px-4 pb-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{post.content}</p>}{post.media_url && (post.media_type === 'video' ? <video src={post.media_url} controls playsInline className="max-h-[520px] w-full bg-black object-contain"/> : <img src={post.media_url} alt="Вложение к посту" className="max-h-[520px] w-full bg-slate-100 object-contain dark:bg-slate-800"/>)}<div className="flex items-center justify-between px-4 py-2 text-xs text-slate-500"><span>{post.likes_count ? `♥ ${post.likes_count}` : ' '}</span><button onClick={() => void showComments(post.id)}>{post.comments_count} комментариев</button></div><div className="mx-4 border-t border-slate-100 dark:border-slate-800"/><div className="grid grid-cols-2 gap-1 p-2"><button type="button" onClick={() => void toggleLike(post)} className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition hover:bg-slate-100 dark:hover:bg-slate-800 ${post.liked ? 'text-[#1877f2]' : 'text-slate-600 dark:text-slate-300'}`}><Heart size={18} fill={post.liked ? 'currentColor' : 'none'}/>Нравится</button><button type="button" onClick={() => void showComments(post.id)} className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><MessageCircle size={18}/>Комментировать</button></div>
        {openComments === post.id && <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800"><div className="space-y-3">{(comments[post.id] ?? []).map(comment => <div key={comment.id} className="flex gap-2"><div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-200 text-center text-xs font-bold leading-8 dark:bg-slate-800">{comment.author?.avatar_url ? <img src={comment.author.avatar_url} alt="" className="h-full w-full object-cover"/> : comment.author?.display_name.slice(0,1)}</div><div className="min-w-0 flex-1 rounded-xl bg-[#f0f2f5] px-3 py-2 dark:bg-slate-800"><p className="text-xs font-bold text-slate-800 dark:text-white">{comment.author?.display_name}</p><p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{comment.content}</p></div>{comment.profile_id === profile.id && <button onClick={() => void deleteComment(comment)} title="Удалить комментарий" className="self-center text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>}</div>)}</div><div className="mt-3 flex gap-2"><input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void addComment(post.id); }} placeholder="Написать комментарий..." className="min-w-0 flex-1 rounded-full bg-[#f0f2f5] px-4 py-2 text-sm outline-none dark:bg-slate-800 dark:text-white"/><button onClick={() => void addComment(post.id)} disabled={!commentText.trim() || commentBusy} className="rounded-full bg-[#1877f2] px-4 text-sm font-semibold text-white disabled:opacity-40">{commentBusy ? '...' : 'Отправить'}</button></div></div>}
      </article>)}
    </div>
  </div>;
}
