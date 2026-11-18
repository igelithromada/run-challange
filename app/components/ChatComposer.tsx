"use client";

import { useEffect, useRef, useState } from 'react';
import { ListPlus, Send, X } from 'lucide-react';
import { auth } from '../lib/firebase';
import type { ChatRecord, ChatReply } from '../lib/chat';
import { activityLabel } from '../lib/activity';
import ChatActivityPreview from './ChatActivityPreview';

const attachmentTrigger = /(^|\s)@$/;
export default function ChatComposer({ uid, reply, onCancelReply, onSend }: {
  uid: string;
  reply: ChatReply | null;
  onCancelReply: () => void;
  onSend: (text: string, activityId: string | undefined, replyId: string | undefined, clientId: string) => Promise<boolean>;
}) {
  const [text, setText] = useState('');
  const [record, setRecord] = useState<ChatRecord | null>(null);
  const [picker, setPicker] = useState(false);
  const [records, setRecords] = useState<ChatRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const pickerPanel = useRef<HTMLDialogElement>(null);
  const pending = useRef<{ key: string; id: string } | null>(null);
  const sending = useRef(false);
  const latestReply = useRef(reply);
  useEffect(() => { latestReply.current = reply; }, [reply]);

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
    setRecords([]);

    async function load() {
      try {
        const response = await fetch('/api/chat?picker=records', {
          cache: 'no-store',
          signal: controller.signal,
          headers: { Authorization: 'Bearer ' + await user!.getIdToken() },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Záznamy se nepodařilo načíst.');
        if (!controller.signal.aborted) setRecords(data.records || []);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Záznamy se nepodařilo načíst.');
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

  function closePicker(selected?: ChatRecord) {
    if (selected) setRecord(selected);
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
    if (picker || (!message && !record) || sending.current || !uid) return;
    sending.current = true;
    setBusy(true);
    const key = JSON.stringify([message, record?.id, reply?.id]);
    const attempt = pending.current?.key === key ? pending.current : { key, id: crypto.randomUUID() };
    pending.current = attempt;
    try {
      if (await onSend(message, record?.id, reply?.id, attempt.id)) {
        pending.current = null;
        setText(current => current.trim() === message ? '' : current);
        setRecord(current => current === record ? null : current);
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
        closePicker();
      }}>
      <header>
        <strong id="chat-picker-title">Poslední záznamy</strong>
        <button type="button" className="ui-icon-button" aria-label="Zavřít výběr záznamu" onClick={() => closePicker()}><X size={18}/></button>
      </header>
      <div className="chat-record-picker-list">
        {loading ? <p role="status">Načítám záznamy…</p> : error ? <p role="alert">{error}</p> : records.length
          ? records.map(item => <div key={item.id} className="chat-record-option">
              <ChatActivityPreview record={item}/>
              <button type="button" onClick={() => closePicker(item)}
                aria-label={`Připojit záznam: ${item.nickname}, ${activityLabel(item.type)}`}>
                Připojit
              </button>
            </div>)
          : <p>Zatím tu nejsou žádné záznamy ke sdílení.</p>}
      </div>
    </dialog>}
    {!picker && record && <div className="chat-selected-activity">
      <ChatActivityPreview record={record}/>
      <button type="button" aria-label="Odebrat připojený záznam" onClick={() => setRecord(null)}><X size={18}/></button>
    </div>}
    <form className="chat-compose" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <button type="button" className="ui-icon-button chat-attach-record" disabled={!uid || busy}
        aria-haspopup="dialog" aria-label="Připojit záznam" title="Připojit záznam" onClick={() => setPicker(true)}>
        <ListPlus size={20}/>
      </button>
      <label htmlFor="chat-text" className="sr-only">Zpráva do společného chatu</label>
      <textarea ref={input} id="chat-text" value={text} maxLength={1000} rows={2} disabled={!uid}
        placeholder={record ? 'Napiš něco k záznamu…' : 'Napiš zprávu…'}
        onChange={e => {
          const value = e.target.value;
          const open = attachmentTrigger.test(value);
          setText(value);
          setPicker(open);
        }}
        onKeyDown={e => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!picker) void submit();
          }
        }} />
      <button type="submit" className="run-primary-button"
        disabled={!uid || picker || busy || (!text.trim() && !record)} aria-label="Odeslat zprávu">
        <Send size={20}/><span>{busy ? 'Odesílám…' : 'Odeslat'}</span>
      </button>
    </form>
    <small className="chat-hint">@ připojí záznam · Enter odešle · {text.length}/1000</small>
  </>;
}
