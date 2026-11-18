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
type Page={messages:Message[];hasMore:boolean;cursor:string|null;revision?:string;unchanged?:boolean};
async function request(init?:RequestInit,before?:string,revision?:string):Promise<Page>{
 const user=auth.currentUser;if(!user)throw new Error('Nejsi přihlášen.');
 const response=await fetch('/api/chat'+(before?'?before='+encodeURIComponent(before):revision?'?revision='+encodeURIComponent(revision):''),{...init,cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken(),...init?.headers}});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Chat není dostupný.');return data;
}
export default function ChatPage(){
 const router=useRouter(),[uid,setUid]=useState(''),[menu,setMenu]=useState(false),[messages,setMessages]=useState<Message[]>([]),[reply,setReply]=useState<ChatReply|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[olderBusy,setOlderBusy]=useState(false),[more,setMore]=useState(false),[cursor,setCursor]=useState<string|null>(null),[newMessages,setNewMessages]=useState(false);
 const refreshSequence = useRef(0);
 const lastAppliedRefresh = useRef(0);
 const latestMessage = useRef<string | null>(null);
 const readMessage = useRef<string | null>(null);
 const list=useRef<HTMLDivElement>(null),generation=useRef(0),initial=useRef(true),lastFull=useRef(0),revision=useRef<string|undefined>(undefined);
 useEffect(()=>onAuthStateChanged(auth,user=>{generation.current++;latestMessage.current=null;readMessage.current=null;setUid(user?.uid||'');setMessages([]);setReply(null);initial.current=true;revision.current=undefined;lastFull.current=0;setCursor(null);setMore(false);if(!user)router.push('/login');}),[router]);
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
 const refresh=useCallback(async()=>{
  const version=generation.current;if(!uid||auth.currentUser?.uid!==uid)return;
  const serial = ++refreshSequence.current;
  try{
   const full=Date.now()-lastFull.current>60000;const data=await request(undefined,undefined,full?undefined:revision.current);if(version!==generation.current || serial < lastAppliedRefresh.current)return;lastAppliedRefresh.current=serial;if(full)lastFull.current=Date.now();revision.current=data.revision;if(data.unchanged){
    const el = list.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 100) markRead();
    setError('');return;
   }
   latestMessage.current = data.messages.at(-1)?.id || null;
   const el=list.current,nearBottom=!el||el.scrollHeight-el.scrollTop-el.clientHeight<100;
   setMessages(old=>{const map=new Map(old.map(m=>[m.id,m]));let added=false;for(const message of data.messages){if(!map.has(message.id))added=true;map.set(message.id,message);}if(added&&!nearBottom&&!initial.current)setNewMessages(true);return [...map.values()].sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||'')||a.id.localeCompare(b.id));});
   if(initial.current){setMore(data.hasMore);setCursor(data.cursor);initial.current=false;}
   if(nearBottom)requestAnimationFrame(bottom);
   setError('');
  }catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Chat se nepodařilo načíst.');}
  finally{if(version===generation.current)setLoading(false);}
 },[uid,bottom,markRead]);
 useEffect(()=>{if(!uid)return;setLoading(true);void refresh();let active=true,timer:ReturnType<typeof setTimeout>;
  const tick=async()=>{if(!active)return;if(document.visibilityState==='visible')await refresh();if(active)timer=setTimeout(tick,15000);};timer=setTimeout(tick,15000);
  const visible=()=>{if(document.visibilityState==='visible')void refresh();};document.addEventListener('visibilitychange',visible);window.addEventListener('online',visible);window.addEventListener(CHAT_CHANGED,visible);
  return()=>{active=false;clearTimeout(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',visible);window.removeEventListener(CHAT_CHANGED,visible);};
 },[uid,refresh]);
 const send=async(text:string,photos:ChatPhotoSelection[],replyTo:string|undefined,clientId:string)=>{
  const version=generation.current;setError('');
  try{await request({method:'POST',body:JSON.stringify({text,photos,replyTo,clientId})});if(version!==generation.current)return false;await refresh();requestAnimationFrame(bottom);return true;}
  catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Zprávu se nepodařilo odeslat.');return false;}
 };
 const older=async()=>{
  if(!cursor||olderBusy)return;const version=generation.current,el=list.current,height=el?.scrollHeight||0,top=el?.scrollTop||0;setOlderBusy(true);
  try{const data=await request(undefined,cursor);if(version!==generation.current)return;setMessages(old=>[...data.messages.filter(m=>!old.some(o=>o.id===m.id)),...old]);setMore(data.hasMore);setCursor(data.cursor);requestAnimationFrame(()=>{if(el)el.scrollTop=top+el.scrollHeight-height;});}
  catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Starší zprávy nelze načíst.');}finally{setOlderBusy(false);}
 };
 const remove=async(id:string)=>{const version=generation.current;try{await request({method:'DELETE',body:JSON.stringify({id})});if(version!==generation.current)return;setMessages(old=>old.map(m=>m.id===id?{...m,deleted:true,text:''}:m));}catch(e){setError(e instanceof Error?e.message:'Zprávu nelze odstranit.');}};
 return <><Navbar title="Společný chat" onMenuClick={()=>setMenu(true)} onHomeClick={()=>router.push('/')}/><Sidebar visible={menu} onClose={()=>setMenu(false)} onSelect={()=>{}}/>
 <main className="container chat-page"><section className="tile chat-panel" aria-label="Společný chat">
  <header className="chat-heading"><MessageCircle size={22}/><div><h1>Společný chat </h1></div></header>
  <div ref={list} className="chat-messages" role="log" aria-label="Zprávy ve společném chatu" aria-live="polite" aria-relevant="additions text" tabIndex={0} onScroll={()=>{const el=list.current;if(el&&el.scrollHeight-el.scrollTop-el.clientHeight<100){setNewMessages(false);markRead();}}}>
   {more&&<button className="tile-button chat-older" disabled={olderBusy} onClick={()=>void older()}>{olderBusy?'Načítám…':'Starší zprávy'}</button>}
   {loading&&!messages.length?<p role="status">Načítám chat…</p>:!messages.length&&!error?<p className="chat-empty">Zatím tu není žádná zpráva. Napiš první.</p>:null}
   {messages.map(message=><article key={message.id} className={`chat-message${message.uid===uid?' is-mine':''}${!message.deleted&&(message.activity||message.activities?.length)?' has-photos':''}`}><header><strong>{message.nickname}</strong><time dateTime={message.createdAt||undefined}>{message.createdAt?new Date(message.createdAt).toLocaleString('cs-CZ',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'}):'Právě teď'}</time>{message.canDelete&&!message.deleted&&<button type="button" className="chat-delete" aria-label="Odstranit zprávu" title="Odstranit zprávu" onClick={()=>void remove(message.id)}><Trash2 size={16}/></button>}</header>{!message.deleted&&message.reply&&<blockquote className="chat-reply-preview"><strong>{message.reply.nickname}</strong><span>{message.reply.text}</span></blockquote>}{!message.deleted&&(message.activity||Boolean(message.activities?.length))&&<ChatActivityPreview activities={message.activities?.length?message.activities:message.activity?[message.activity]:[]} messageId={message.id}/>} {!message.deleted&&message.activityUnavailable&&<p className="chat-deleted">Fotky už nejsou dostupné.</p>}<p className={message.deleted?'chat-deleted':''}>{message.deleted?'Zpráva byla odstraněna.':message.text}</p>{!message.deleted&&<button type="button" className="chat-reply-button" onClick={()=>setReply({id:message.id,nickname:message.nickname,text:message.text||'Sdílené fotky'})}><Reply size={16}/> Odpovědět</button>}</article>)}
  </div>
  {newMessages&&<button className="tile-button" onClick={bottom}>Nové zprávy ↓</button>}
  {error&&<p className="chat-error" role="alert">{error} <button type="button" onClick={()=>void refresh()}>Zkusit načíst znovu</button></p>}
  <ChatComposer key={uid} uid={uid} reply={reply} onCancelReply={()=>setReply(null)} onSend={send}/>
 </section></main></>;
}
