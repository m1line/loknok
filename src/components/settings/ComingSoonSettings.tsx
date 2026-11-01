import { useEffect, useState } from 'react';
import { FolderPlus, Trash2, Database, KeyRound } from 'lucide-react';
import { SettingsGroup, SettingsPageShell, ToggleRow } from '@/components/settings/SettingsParts';

type Props = { title: string; onBack: () => void };
const readList = (key: string): string[] => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []; } catch { return []; } };

export default function ComingSoonSettings({ title, onBack }: Props) {
  const [folders, setFolders] = useState<string[]>(() => readList('messenger-chat-folders'));
  const [folderName, setFolderName] = useState('');
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem('messenger-reduced-motion') === 'true');
  const [language, setLanguage] = useState(() => localStorage.getItem('messenger-language') || 'ru');
  const [storageText, setStorageText] = useState('Проверяем занятое место…');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (title !== 'Данные и память') return;
    if (navigator.storage?.estimate) {
      void navigator.storage.estimate().then(({ usage, quota }) => {
        const mb = (usage ?? 0) / 1024 / 1024;
        const total = (quota ?? 0) / 1024 / 1024;
        setStorageText(`${mb.toFixed(1)} МБ используется${total ? ` из ${total.toFixed(0)} МБ доступных` : ''}`);
      }).catch(() => setStorageText('Браузер не предоставил данные о хранилище.'));
    } else setStorageText('Оценка хранилища не поддерживается этим браузером.');
  }, [title]);

  const addFolder = () => {
    const name = folderName.trim().slice(0, 24);
    if (!name || folders.some(item => item.toLowerCase() === name.toLowerCase())) return;
    const next = [...folders, name]; setFolders(next); localStorage.setItem('messenger-chat-folders', JSON.stringify(next)); setFolderName('');
  };

  const toggleMotion = (value: boolean) => {
    setReducedMotion(value); localStorage.setItem('messenger-reduced-motion', String(value));
    document.documentElement.classList.toggle('reduce-motion', value);
  };

  const clearCache = async () => {
    try {
      if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.map(key => caches.delete(key))); }
      setNotice('Кэш браузера очищен. Данные аккаунта и переписки не затронуты.');
    } catch { setNotice('Не удалось очистить кэш браузера.'); }
  };

  return <SettingsPageShell title={title} onBack={onBack}>
    {title === 'Данные и память' && <div className="space-y-4">
      <SettingsGroup><div className="flex items-center gap-3 px-4 py-4"><Database className="text-brand-600"/><div><p className="font-semibold text-slate-900">Хранилище сайта</p><p className="text-sm text-slate-500">{storageText}</p></div></div></SettingsGroup>
      <SettingsGroup><button onClick={() => void clearCache()} className="w-full px-4 py-4 text-left"><p className="font-semibold text-slate-900">Очистить кэш браузера</p><p className="mt-1 text-sm text-slate-500">Удаляет временные файлы сайта, но не аккаунт и не сообщения.</p></button></SettingsGroup>
      {notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
    </div>}
    {title === 'Папки с чатами' && <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-500">Создавай свои категории, чтобы подготовить удобную сортировку чатов. Список папок сохраняется на этом устройстве.</p>
      <div className="flex gap-2"><input value={folderName} onChange={e => setFolderName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addFolder(); }} maxLength={24} placeholder="Название папки" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-brand-500"/><button onClick={addFolder} disabled={!folderName.trim()} className="rounded-xl bg-brand-500 px-4 text-white disabled:opacity-40"><FolderPlus size={19}/></button></div>
      <SettingsGroup>{folders.length ? folders.map(folder => <div key={folder} className="flex items-center justify-between px-4 py-3"><span className="text-sm font-medium text-slate-800">{folder}</span><button onClick={() => { const next = folders.filter(item => item !== folder); setFolders(next); localStorage.setItem('messenger-chat-folders', JSON.stringify(next)); }} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={17}/></button></div>) : <p className="px-4 py-5 text-sm text-slate-500">Пока нет созданных папок.</p>}</SettingsGroup>
    </div>}
    {title === 'Энергосбережение' && <SettingsGroup><ToggleRow label="Уменьшить анимации" description="Отключает большую часть анимаций интерфейса для более плавной работы." checked={reducedMotion} onChange={toggleMotion}/></SettingsGroup>}
    {title === 'Язык' && <div className="space-y-3"><p className="text-sm text-slate-500">Выбери предпочитаемый язык интерфейса. Сейчас основная часть приложения доступна на русском.</p><SettingsGroup>{[{id:'ru',label:'Русский'},{id:'uk',label:'Українська'},{id:'en',label:'English'}].map(item => <label key={item.id} className="flex cursor-pointer items-center justify-between px-4 py-4"><span className="text-sm font-medium text-slate-800">{item.label}</span><input type="radio" name="language" checked={language === item.id} onChange={() => { setLanguage(item.id); localStorage.setItem('messenger-language', item.id); }} className="h-4 w-4 accent-blue-600"/></label>)}</SettingsGroup><p className="text-xs text-slate-400">Выбор сохраняется на устройстве; перевод всех экранов будет добавлен отдельно.</p></div>}
    {title === 'Ключи доступа' && <div className="space-y-3"><div className="rounded-2xl bg-white p-5 text-center shadow-sm"><KeyRound size={30} className="mx-auto text-brand-600"/><p className="mt-3 font-semibold text-slate-900">Защита аккаунта</p><p className="mt-1 text-sm text-slate-500">Управление паролем и блокировкой приложения доступно в разделе «Конфиденциальность → Безопасность».</p></div></div>}
    {!['Данные и память','Папки с чатами','Энергосбережение','Язык','Ключи доступа'].includes(title) && <div className="rounded-xl bg-white p-5 text-sm text-slate-600">Раздел настроек «{title}» пока не поддерживается.</div>}
  </SettingsPageShell>;
}
