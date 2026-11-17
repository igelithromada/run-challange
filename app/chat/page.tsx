"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {MessageCircle,Send,Trash2} from 'lucide-react';
import {useRouter} from 'next/navigation';
import {auth} from '../lib/firebase';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

type Message={id:string;uid:string;nickname:string;text:string;deleted:boolean;createdAt:string|null;canDelete:boolean};
type Page={messages:Message[];hasMore:boolean;cursor:string|null;revision?:string;unchanged?:boolean};
async function request(init?:RequestInit,before?:string,revision?:string):Promise<Page>{
 const user=auth.currentUser;if(!user)throw new Error('Nejsi přihlášen.');
 const response=await fetch('/api/chat'+(before?'?before='+encodeURIComponent(before):revision?'?revision='+encodeURIComponent(revision):''),{...init,cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken(),...init?.headers}});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Chat není dostupný.');return data;
}
export default function ChatPage(){
 const router=useRouter(),[uid,setUid]=useState(''),[menu,setMenu]=useState(false),[messages,setMessages]=useState<Message[]>([]),[text,setText]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[olderBusy,setOlderBusy]=useState(false),[more,setMore]=useState(false),[cursor,setCursor]=useState<string|null>(null),[newMessages,setNewMessages]=useState(false);
 const list=useRef<HTMLDivElement>(null),generation=useRef(0),pending=useRef<{text:string;id:string}|null>(null),sending=useRef(false),initial=useRef(true),revision=useRef<string|undefined>(undefined);
 useEffect(()=>onAuthStateChanged(auth,user=>{generation.current++;setUid(user?.uid||'');setMessages([]);setText('');pending.current=null;initial.current=true;revision.current=undefined;setCursor(null);setMore(false);if(!user)router.push('/login');}),[router]);
 const bottom=()=>{const el=list.current;if(el)el.scrollTop=el.scrollHeight;setNewMessages(false);};
 const refresh=useCallback(async()=>{
  const version=generation.current;if(!uid||auth.currentUser?.uid!==uid)return;
  try{
   const data=await request(undefined,undefined,revision.current);if(version!==generation.current)return;revision.current=data.revision;if(data.unchanged){setError('');return;}
   const el=list.current,nearBottom=!el||el.scrollHeight-el.scrollTop-el.clientHeight<100;
   setMessages(old=>{const map=new Map(old.map(m=>[m.id,m]));let added=false;for(const message of data.messages){if(!map.has(message.id))added=true;map.set(message.id,message);}if(added&&!nearBottom&&!initial.current)setNewMessages(true);return [...map.values()].sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||'')||a.id.localeCompare(b.id));});
   if(initial.current){setMore(data.hasMore);setCursor(data.cursor);initial.current=false;}
   if(nearBottom)requestAnimationFrame(bottom);
   setError('');
  }catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Chat se nepodařilo načíst.');}
  finally{if(version===generation.current)setLoading(false);}
 },[uid]);
 useEffect(()=>{if(!uid)return;setLoading(true);void refresh();let active=true,timer:ReturnType<typeof setTimeout>;
  const tick=async()=>{if(!active)return;if(document.visibilityState==='visible')await refresh();if(active)timer=setTimeout(tick,15000);};timer=setTimeout(tick,15000);
  const visible=()=>{if(document.visibilityState==='visible')void refresh();};document.addEventListener('visibilitychange',visible);window.addEventListener('online',visible);
  return()=>{active=false;clearTimeout(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',visible);};
 },[uid,refresh]);
 const send=async()=>{
  const message=text.trim();if(!message||message.length>1000||sending.current||!uid)return;
  const version=generation.current;sending.current=true;setBusy(true);setError('');
  const attempt=pending.current?.text===message?pending.current:{text:message,id:crypto.randomUUID()};pending.current=attempt;
  try{await request({method:'POST',body:JSON.stringify({text:message,clientId:attempt.id})});if(version!==generation.current)return;pending.current=null;setText(current=>current.trim()===message?'':current);await refresh();requestAnimationFrame(bottom);}
  catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Zprávu se nepodařilo odeslat.');}
  finally{sending.current=false;if(version===generation.current)setBusy(false);}
 };
 const older=async()=>{
  if(!cursor||olderBusy)return;const version=generation.current,el=list.current,height=el?.scrollHeight||0,top=el?.scrollTop||0;setOlderBusy(true);
  try{const data=await request(undefined,cursor);if(version!==generation.current)return;setMessages(old=>[...data.messages.filter(m=>!old.some(o=>o.id===m.id)),...old]);setMore(data.hasMore);setCursor(data.cursor);requestAnimationFrame(()=>{if(el)el.scrollTop=top+el.scrollHeight-height;});}
  catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Starší zprávy nelze načíst.');}finally{setOlderBusy(false);}
 };
 const remove=async(id:string)=>{const version=generation.current;try{await request({method:'DELETE',body:JSON.stringify({id})});if(version!==generation.current)return;setMessages(old=>old.map(m=>m.id===id?{...m,deleted:true,text:''}:m));}catch(e){setError(e instanceof Error?e.message:'Zprávu nelze odstranit.');}};
 return <><Navbar title="Společný chat" onMenuClick={()=>setMenu(true)} onHomeClick={()=>router.push('/')}/><Sidebar visible={menu} onClose={()=>setMenu(false)} onSelect={()=>{}}/>
 <main className="container chat-page"><section className="tile chat-panel" aria-label="Společný chat">
  <header className="chat-heading"><MessageCircle size={22}/><div><h1>Společný chat <small>Na zkoušku</small></h1><p>Pro všechny přihlášené. Nové zprávy se načítají po 15 sekundách.</p></div></header>
  <div ref={list} className="chat-messages" role="log" aria-label="Zprávy ve společném chatu" aria-live="polite" aria-relevant="additions text" tabIndex={0} onScroll={()=>{const el=list.current;if(el&&el.scrollHeight-el.scrollTop-el.clientHeight<100)setNewMessages(false);}}>
   {more&&<button className="tile-button chat-older" disabled={olderBusy} onClick={()=>void older()}>{olderBusy?'Načítám…':'Starší zprávy'}</button>}
   {loading&&!messages.length?<p role="status">Načítám chat…</p>:!messages.length&&!error?<p className="chat-empty">Zatím tu není žádná zpráva. Napiš první.</p>:null}
   {messages.map(message=><article key={message.id} className={`chat-message${message.uid===uid?' is-mine':''}`}><header><strong>{message.nickname}</strong><time dateTime={message.createdAt||undefined}>{message.createdAt?new Date(message.createdAt).toLocaleString('cs-CZ',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'}):'Právě teď'}</time>{message.canDelete&&!message.deleted&&<button type="button" className="chat-delete" aria-label="Odstranit zprávu" title="Odstranit zprávu" onClick={()=>void remove(message.id)}><Trash2 size={16}/></button>}</header><p className={message.deleted?'chat-deleted':''}>{message.deleted?'Zpráva byla odstraněna.':message.text}</p></article>)}
  </div>
  {newMessages&&<button className="tile-button" onClick={bottom}>Nové zprávy ↓</button>}
  {error&&<p className="chat-error" role="alert">{error} <button type="button" onClick={()=>void refresh()}>Zkusit načíst znovu</button></p>}
  <form className="chat-compose" onSubmit={e=>{e.preventDefault();void send();}}><label htmlFor="chat-text" className="sr-only">Zpráva do společného chatu</label><textarea id="chat-text" value={text} maxLength={1000} rows={2} disabled={!uid} placeholder="Napiš zprávu…" onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/><button type="submit" className="run-primary-button" disabled={!uid||busy||!text.trim()} aria-label="Odeslat zprávu"><Send size={20}/><span>{busy?'Odesílám…':'Odeslat'}</span></button></form>
  <small className="chat-hint">Enter odešle · Shift + Enter nový řádek · {text.length}/1000</small>
 </section></main></>;
}
