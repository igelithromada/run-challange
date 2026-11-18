"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {MessageCircle,Reply,Trash2} from 'lucide-react';
import {useRouter} from 'next/navigation';
import {auth} from '../lib/firebase';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

import ChatComposer from '../components/ChatComposer';
import ChatActivityPreview from '../components/ChatActivityPreview';
import {CHAT_CHANGED,type ChatActivity,type ChatPhotoSelection,type ChatReply} from '../lib/chat';

type Message={id:string;uid:string;nickname:string;text:string;deleted:boolean;createdAt:string|null;canDelete:boolean;activity?:ChatActivity|null;activities?:ChatActivity[];activityUnavailable?:boolean;reply?:ChatReply|null};
type Page={messages:Message[];hasMore:boolean;cursor:string|null;revision?:string;unchanged?:boolean;delta?:boolean};
async function request(init?:RequestInit,before?:string,revision?:string):Promise<Page>{
 const user=auth.currentUser;if(!user)throw new Error('Nejsi přihlášen.');
 const response=await fetch('/api/chat'+(before?'?before='+encodeURIComponent(before):revision?'?revision='+encodeURIComponent(revision):''),{...init,cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken(),...init?.headers}});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Chat není dostupný.');return data;
}
export default function ChatPage(){
 const router=useRouter(),[uid,setUid]=useState(''),[menu,setMenu]=useState(false),[messages,setMessages]=useState<Message[]>([]),[reply,setReply]=useState<ChatReply|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[olderBusy,setOlderBusy]=useState(false),[more,setMore]=useState(false),[cursor,setCursor]=useState<string|null>(null),[newMessages,setNewMessages]=useState(false);
 const latestMessage = useRef<string | null>(null);
 const latestCreatedAt = useRef('');
 const readMessage = useRef<string | null>(null);
 const olderLock = useRef(false);
 const previousScroll = useRef(0);
 const list = useRef<HTMLDivElement>(null);
 const generation = useRef(0);
 const initial = useRef(true);
 const revision = useRef<string | undefined>(undefined);
 const refreshTask = useRef<{ generation: number; promise: Promise<void>; again: boolean } | null>(null);

 useEffect(() => onAuthStateChanged(auth, user => {
  generation.current++;
  latestMessage.current = null;
  latestCreatedAt.current = '';
  readMessage.current = null;
  olderLock.current = false;
  setOlderBusy(false);
  setUid(user?.uid || '');
  setLoading(Boolean(user));
  setMessages([]);
  setReply(null);
  setError('');
  setNewMessages(false);
  initial.current = true;
  revision.current = undefined;
  setCursor(null);
  setMore(false);
  if (!user) router.push('/login');
 }), [router]);
 const markRead = useCallback(() => {
  const id = latestMessage.current;
  if (!id || readMessage.current === id || document.visibilityState !== 'visible' || auth.currentUser?.uid !== uid) return;
  const version = generation.current;
  readMessage.current = id;
  void request({ method: 'PATCH', body: JSON.stringify({ id }), keepalive: true }).catch(() => {
   if (generation.current === version && readMessage.current === id) readMessage.current = null;
  });
 }, [uid]);
 const bottom = useCallback(() => {
  const el = list.current;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
  setNewMessages(false);
  markRead();
 }, [markRead]);
 const refresh = useCallback(() => {
  const version = generation.current;
  if (!uid || auth.currentUser?.uid !== uid) return Promise.resolve();
  const isCurrent = () => version === generation.current && auth.currentUser?.uid === uid;
  const running = refreshTask.current;
  if (running?.generation === version) {
   running.again = true;
   return running.promise;
  }

  const task = { generation: version, again: false, promise: Promise.resolve() };
  async function sync() {
   do {
    task.again = false;
    try {
     const data = await request(undefined, undefined, revision.current);
     if (!isCurrent()) return;
     revision.current = data.revision;
     const el = list.current;
     const nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 100;
     if (!data.unchanged) {
      const first = initial.current;
      const ordered = [...data.messages].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));
      const newest = ordered.at(-1);
      const hasNewMessages = !!newest && (!latestMessage.current || (newest.createdAt || '') > latestCreatedAt.current ||
       ((newest.createdAt || '') === latestCreatedAt.current && newest.id > latestMessage.current));
      if (!data.delta || hasNewMessages) {
       latestMessage.current = newest?.id || null;
       latestCreatedAt.current = newest?.createdAt || '';
      }
      if (!data.delta) {
       // If the client missed more changes than the server retained, restart pagination from a contiguous page.
       setMessages(ordered);
       setMore(data.hasMore);
       setCursor(data.cursor);
       initial.current = false;
      } else {
       setMessages(old => {
        const merged = new Map(old.map(message => [message.id, message]));
        const removed = new Set(ordered.filter(message => message.deleted).map(message => message.id));
        for (const message of ordered) {
         if (merged.has(message.id) || !message.deleted) merged.set(message.id, message);
        }
        return [...merged.values()].map(message => message.reply && removed.has(message.reply.id)
         ? { ...message, reply: { id: message.reply.id, nickname: '', text: 'Původní zpráva byla odstraněna.' } }
         : message).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));
       });
      }
      if (first || nearBottom) requestAnimationFrame(() => { if (isCurrent()) bottom(); });
      else if (hasNewMessages) setNewMessages(true);
     } else if (nearBottom) {
      markRead();
     }
     setError('');
    } catch (error) {
     if (isCurrent()) setError(error instanceof Error ? error.message : 'Chat se nepodařilo načíst.');
    } finally {
     if (isCurrent()) setLoading(false);
    }
   } while (isCurrent() && task.again);
  }

  refreshTask.current = task;
  task.promise = sync().finally(() => { if (refreshTask.current === task) refreshTask.current = null; });
  return task.promise;
 }, [uid, bottom, markRead]);

 useEffect(() => {
  if (!uid) return;
  void refresh();
  const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
  const timer = setInterval(visible, 120_000);
  document.addEventListener('visibilitychange', visible);
  window.addEventListener('online', visible);
  window.addEventListener(CHAT_CHANGED, visible);
  return () => {
   clearInterval(timer);
   document.removeEventListener('visibilitychange', visible);
   window.removeEventListener('online', visible);
   window.removeEventListener(CHAT_CHANGED, visible);
  };
 }, [uid, refresh]);
 const send=async(text:string,photos:ChatPhotoSelection[],replyTo:string|undefined,clientId:string)=>{
  const version=generation.current;setError('');
  try{await request({method:'POST',body:JSON.stringify({text,photos,replyTo,clientId})});if(version!==generation.current)return false;await refresh();requestAnimationFrame(bottom);return true;}
  catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Zprávu se nepodařilo odeslat.');return false;}
 };
 const older = async () => {
  if (!cursor || olderLock.current) return;
  const version = generation.current;
  olderLock.current = true;
  setOlderBusy(true);
  try {
   const data = await request(undefined, cursor);
   if (version !== generation.current) return;
   const el = list.current;
   const height = el?.scrollHeight || 0;
   const top = el?.scrollTop || 0;
   setMessages(old => [...data.messages.filter(message => !old.some(item => item.id === message.id)), ...old]);
   setMore(data.hasMore);
   setCursor(data.cursor);
   requestAnimationFrame(() => {
    if (el && version === generation.current) el.scrollTop = top + el.scrollHeight - height;
   });
  } catch (error) {
   if (version === generation.current) setError(error instanceof Error ? error.message : 'Starší zprávy nelze načíst.');
  } finally {
   if (version === generation.current) {
    olderLock.current = false;
    setOlderBusy(false);
   }
  }
 };

 function handleScroll() {
  const el = list.current;
  if (!el) return;
  const movingUp = el.scrollTop < previousScroll.current;
  previousScroll.current = el.scrollTop;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
   setNewMessages(false);
   markRead();
  }
  if (movingUp && el.scrollTop < 80 && more) void older();
 }
 const remove=async(id:string)=>{const version=generation.current;try{await request({method:'DELETE',body:JSON.stringify({id})});if(version!==generation.current)return;setMessages(old=>old.map(m=>m.id===id?{...m,deleted:true,text:''}:m));}catch(e){setError(e instanceof Error?e.message:'Zprávu nelze odstranit.');}};
 return <><Navbar title="Společný chat" onMenuClick={()=>setMenu(true)} onHomeClick={()=>router.push('/')}/><Sidebar visible={menu} onClose={()=>setMenu(false)}/>
 <main className="container chat-page"><section className="tile chat-panel" aria-label="Společný chat">
  <header className="chat-heading"><MessageCircle size={22}/><div><h1>Společný chat </h1></div></header>
  <div ref={list} className="chat-messages" role="log" aria-label="Zprávy ve společném chatu" aria-live="polite" aria-relevant="additions text" tabIndex={0} onScroll={handleScroll}>
   {more&&<button className="tile-button chat-older" disabled={olderBusy} onClick={()=>void older()}>{olderBusy?'Načítám…':'Starší zprávy'}</button>}
   {loading&&!messages.length?<p role="status">Načítám chat…</p>:!messages.length&&!error?<p className="chat-empty">Zatím tu není žádná zpráva. Napiš první.</p>:null}
   {messages.map(message=><article key={message.id} className={`chat-message${message.uid===uid?' is-mine':''}${!message.deleted&&(message.activity||message.activities?.length)?' has-photos':''}`}><header><strong>{message.nickname}</strong><time dateTime={message.createdAt||undefined}>{message.createdAt?new Date(message.createdAt).toLocaleString('cs-CZ',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'}):'Právě teď'}</time>{message.canDelete&&!message.deleted&&<button type="button" className="chat-delete" aria-label="Odstranit zprávu" title="Odstranit zprávu" onClick={()=>void remove(message.id)}><Trash2 size={16}/></button>}</header>{!message.deleted&&message.reply&&<blockquote className="chat-reply-preview"><strong>{message.reply.nickname}</strong><span>{message.reply.text}</span></blockquote>}{!message.deleted&&(message.activity||Boolean(message.activities?.length))&&<ChatActivityPreview activities={message.activities?.length?message.activities:message.activity?[message.activity]:[]} messageId={message.id}/>} {!message.deleted&&message.activityUnavailable&&<p className="chat-deleted">Fotky už nejsou dostupné.</p>}<p className={message.deleted?'chat-deleted':''}>{message.deleted?'Zpráva byla odstraněna.':message.text}</p>{!message.deleted&&<button type="button" className="chat-reply-button" onClick={()=>setReply({id:message.id,nickname:message.nickname,text:message.text||'Sdílené fotky'})}><Reply size={16}/> Odpovědět</button>}</article>)}
  </div>
  {newMessages&&<button className="tile-button" onClick={bottom}>Nové zprávy ↓</button>}
  {error&&<p className="chat-error" role="alert">{error} <button type="button" onClick={()=>void refresh()}>Zkusit načíst znovu</button></p>}
  <ChatComposer key={uid} uid={uid} reply={reply} onCancelReply={()=>setReply(null)} onSend={send}/>
 </section></main></>;
}
