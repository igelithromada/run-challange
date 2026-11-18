"use client";

import { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { auth } from '../lib/firebase';
import { groupChatPhotos, MAX_CHAT_PHOTOS, type ChatActivity, type ChatPhotoSelection, type ChatReply } from '../lib/chat';
import ChatActivityPreview from './ChatActivityPreview';

const attachmentTrigger = /(^|\s)@$/;
const samePhoto = (photo: ChatPhotoSelection, activityId: string, thumbnail: string) =>
  photo.activityId === activityId && photo.thumbnail === thumbnail;

export default function ChatComposer({ uid, reply, onCancelReply, onSend }: {
  uid: string;
  reply: ChatReply | null;
  onCancelReply: () => void;
  onSend: (text: string, photos: ChatPhotoSelection[], replyId: string | undefined, clientId: string) => Promise<boolean>;
}) {
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<ChatPhotoSelection[]>([]);
  const [selection, setSelection] = useState<ChatPhotoSelection[]>([]);
  const [picker, setPicker] = useState(false);
  const [activities, setActivities] = useState<ChatActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const pickerPanel = useRef<HTMLDialogElement>(null);
  const pending = useRef<{ key: string; id: string } | null>(null);
  const sending = useRef(false);
  const latestReply = useRef(reply);
  latestReply.current = reply;

  useEffect(() => { if (reply) input.current?.focus(); }, [reply]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!picker || !user || user.uid !== uid) return;
    const controller = new AbortController();
    const panel = pickerPanel.current;
    const viewport = window.visualViewport;
    function fitPicker() {
      panel?.style.setProperty('--picker-height', (viewport?.height ?? window.innerHeight) + 'px');
      panel?.style.setProperty('--picker-top', (viewport?.offsetTop ?? 0) + 'px');
    }
    input.current?.blur();
    fitPicker();
    panel?.showModal();
    viewport?.addEventListener('resize', fitPicker);
    viewport?.addEventListener('scroll', fitPicker);
    setLoading(true);
    setError('');
    setActivities([]);

    async function load() {
      try {
        const response = await fetch('/api/chat?picker=activities', {
          cache: 'no-store',
          signal: controller.signal,
          headers: { Authorization: 'Bearer ' + await user!.getIdToken() },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Fotky se nepodařilo načíst.');
        if (!controller.signal.aborted) setActivities(data.activities || []);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Fotky se nepodařilo načíst.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => {
      controller.abort();
      panel?.close();
      viewport?.removeEventListener('resize', fitPicker);
      viewport?.removeEventListener('scroll', fitPicker);
    };
  }, [picker, uid]);

  function toggle(activityId: string, thumbnail: string) {
    setSelection(current => {
      if (current.some(photo => samePhoto(photo, activityId, thumbnail))) {
        return current.filter(photo => !samePhoto(photo, activityId, thumbnail));
      }
      return current.length >= MAX_CHAT_PHOTOS ? current : [...current, { activityId, thumbnail }];
    });
  }

  function closePicker(confirm: boolean) {
    if (confirm) setPhotos(selection);
    pickerPanel.current?.close();
    setPicker(false);
    setText(current => current.replace(attachmentTrigger, '$1'));
    const field = input.current;
    field?.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      if (field && document.activeElement === field) {
        field.setSelectionRange(field.value.length, field.value.length);
        field.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  async function submit() {
    const message = text.trim();
    if (picker || (!message && !photos.length) || sending.current || !uid) return;
    sending.current = true;
    setBusy(true);
    const key = JSON.stringify([message, photos, reply?.id]);
    const attempt = pending.current?.key === key ? pending.current : { key, id: crypto.randomUUID() };
    pending.current = attempt;
    try {
      if (await onSend(message, photos, reply?.id, attempt.id)) {
        pending.current = null;
        setText(current => current.trim() === message ? '' : current);
        setPhotos(current => current === photos ? [] : current);
        if (latestReply.current?.id === reply?.id) onCancelReply();
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return <>
    {reply && <div className="chat-selected-reply"><div><small>Odpovídáš uživateli {reply.nickname}</small>
      <p>{reply.text.slice(0, 120)}</p></div><button type="button" aria-label="Zrušit odpověď" onClick={onCancelReply}><X size={18}/></button>
    </div>}
    {picker && <dialog ref={pickerPanel} className="chat-activity-picker"
      aria-labelledby="chat-picker-title" onCancel={event => {
        event.preventDefault();
        closePicker(false);
      }}>
      <header><strong id="chat-picker-title">Vyber fotky ze záznamů</strong><button type="button" className="ui-icon-button" aria-label="Zrušit výběr fotek" onClick={() => closePicker(false)}><X size={18}/></button></header>
      <div className="chat-photo-picker-list">
      {loading ? <p role="status">Načítám fotky…</p> : error ? <p role="alert">{error}</p> : activities.length
        ? activities.map(item => <ChatActivityPreview key={item.id} activities={[item]} select={toggle}
            selected={(id, url) => selection.some(photo => samePhoto(photo, id, url))}
            atLimit={selection.length >= MAX_CHAT_PHOTOS} />)
        : <p>Zatím nemáš v záznamech žádné fotky ke sdílení.</p>}
      </div>
      <div className="chat-photo-picker-actions">
        <span aria-live="polite">Vybráno {selection.length} / {MAX_CHAT_PHOTOS}</span>
        <button type="button" className="tile-button" onClick={() => closePicker(true)}>Hotovo</button>
      </div>
    </dialog>}
    {!picker && photos.length > 0 && <div className="chat-selected-activity">
      <ChatActivityPreview activities={groupChatPhotos(photos)} />
      <button type="button" aria-label="Odebrat všechny připojené fotky" onClick={() => setPhotos([])}><X size={18}/></button>
    </div>}
    {photos.length > 0 && <label className="chat-activity-message-label" htmlFor="chat-text">Zpráva k fotkám</label>}
    <form className="chat-compose" onSubmit={e => { e.preventDefault(); void submit(); }}>
      {!photos.length && <label htmlFor="chat-text" className="sr-only">Zpráva do společného chatu</label>}
      <textarea ref={input} id="chat-text" value={text} maxLength={1000} rows={2} disabled={!uid}
        placeholder={photos.length ? 'Napiš něco k fotkám…' : 'Napiš zprávu… @ připojí fotky'}
        onChange={e => {
          const value = e.target.value;
          const open = attachmentTrigger.test(value);
          if (open && !picker) setSelection(photos);
          setText(value);
          setPicker(open);
        }}
        onKeyDown={e => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Escape' && picker) closePicker(false);
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!picker) void submit();
          }
        }} />
      <button type="submit" className="run-primary-button"
        disabled={!uid || picker || busy || (!text.trim() && !photos.length)} aria-label="Odeslat zprávu">
        <Send size={20}/><span>{busy ? 'Odesílám…' : 'Odeslat'}</span>
      </button>
    </form>
    <small className="chat-hint">@ připojí fotky · Enter odešle · {text.length}/1000</small>
  </>;
}
