"use client";
import {useEffect,useRef,useState} from 'react';
import {AtSign,Send,X} from 'lucide-react';
import {auth} from '../lib/firebase';
import type {ChatActivity,ChatReply} from '../lib/chat';
import ChatActivityPreview from './ChatActivityPreview';
export default function ChatComposer({uid,reply,onCancelReply,onSend}:{uid:string;reply:ChatReply|null;onCancelReply:()=>void;onSend:(text:string,activityId?:string,replyId?:string,clientId?:string)=>Promise<boolean>}){
 const [text,setText]=useState(''),[activity,setActivity]=useState<ChatActivity|null>(null),[picker,setPicker]=useState(false),[activities,setActivities]=useState<ChatActivity[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const input=useRef<HTMLTextAreaElement>(null),pending=useRef<{key:string;id:string}|null>(null),sending=useRef(false),version=useRef(0),latestReply=useRef(reply);latestReply.current=reply;
 useEffect(()=>{version.current++;setText('');setActivity(null);setPicker(false);setActivities([]);pending.current=null;},[uid]);
 useEffect(()=>{if(reply)input.current?.focus();},[reply]);
 useEffect(()=>{
  if(!picker||!uid)return;let active=true;const generation=version.current;setLoading(true);setError('');setActivities([]);
  (async()=>{try{const user=auth.currentUser;if(!user||user.uid!==uid)return;const response=await fetch('/api/chat?picker=activities',{cache:'no-store',headers:{Authorization:'Bearer '+await user.getIdToken()}});const data=await response.json();if(!response.ok)throw new Error(data.error||'Aktivity nelze načíst.');if(active&&generation===version.current)setActivities(data.activities||[]);}catch(e){if(active)setError(e instanceof Error?e.message:'Aktivity nelze načíst.');}finally{if(active)setLoading(false);}})();
  return()=>{active=false;};
 },[picker,uid]);
 function selectActivity(item: ChatActivity) {
  setActivity(item);
  setPicker(false);
  setText(current => current.replace(/(^|\s)@$/, '$1'));

  // Focus during the tap so mobile browsers can open the keyboard.
  const field = input.current;
  field?.focus({preventScroll: true});
  requestAnimationFrame(() => {
   if (field && document.activeElement === field) {
    field.setSelectionRange(field.value.length, field.value.length);
    field.scrollIntoView({block: 'nearest'});
   }
  });
 }
 const submit=async()=>{
  const message=text.trim();if((!message&&!activity)||sending.current||!uid)return;
  sending.current=true;setBusy(true);const generation=version.current,selected=activity,selectedReply=reply,key=JSON.stringify([message,activity?.id,reply?.id]);
  const attempt=pending.current?.key===key?pending.current:{key,id:crypto.randomUUID()};pending.current=attempt;
  try{if(await onSend(message,activity?.id,reply?.id,attempt.id)){if(generation!==version.current)return;pending.current=null;setText(current=>current.trim()===message?'':current);setActivity(current=>current?.id===selected?.id?null:current);if(latestReply.current?.id===selectedReply?.id)onCancelReply();setPicker(false);}}
  finally{sending.current=false;if(generation===version.current)setBusy(false);}
 };
 return <>
  {reply&&<div className="chat-selected-reply"><div><small>Odpovídáš uživateli {reply.nickname}</small><p>{reply.text.slice(0,120)}</p></div><button type="button" aria-label="Zrušit odpověď" onClick={onCancelReply}><X size={18}/></button></div>}
  <button type="button" className="chat-attach-button" onClick={()=>setPicker(open=>!open)} aria-expanded={picker} aria-controls="chat-activity-picker"><AtSign size={17}/> Připojit fotky</button>
  {picker&&<section id="chat-activity-picker" className="chat-activity-picker" aria-label="Fotky z posledních tří mých záznamů"><header><strong>Fotky z posledních 3 záznamů</strong><button type="button" aria-label="Zavřít výběr aktivit" onClick={()=>setPicker(false)}><X size={18}/></button></header>{loading?<p role="status">Načítám fotky…</p>:error?<p role="alert">{error}</p>:activities.length?activities.map(item=><ChatActivityPreview key={item.id} activity={item} select={()=>selectActivity(item)}/>):<p>Zatím nemáš v záznamech žádné fotky ke sdílení.</p>}</section>}
  {activity&&<div className="chat-selected-activity"><ChatActivityPreview activity={activity}/><button type="button" aria-label="Odebrat připojené fotky" onClick={()=>setActivity(null)}><X size={18}/></button></div>}
  {activity&&<label className="chat-activity-message-label" htmlFor="chat-text">Zpráva k fotkám</label>}
  <form className="chat-compose" onSubmit={e=>{e.preventDefault();void submit();}}>{!activity&&<label htmlFor="chat-text" className="sr-only">Zpráva do společného chatu</label>}<textarea ref={input} id="chat-text" value={text} maxLength={1000} rows={2} disabled={!uid} placeholder={activity?'Napiš něco k fotkám…':'Napiš zprávu… @ připojí fotky'} onChange={e=>{setText(e.target.value);setPicker(/(^|\s)@$/.test(e.target.value));}} onKeyDown={e=>{if(e.key==='Escape'){setPicker(false);return;}if(e.key==='Enter'&&picker){e.preventDefault();return;}if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void submit();}}}/><button type="submit" className="run-primary-button" disabled={!uid||busy||(!text.trim()&&!activity)} aria-label="Odeslat zprávu"><Send size={20}/><span>{busy?'Odesílám…':'Odeslat'}</span></button></form>
  <small className="chat-hint">@ připojí fotky · Enter odešle · {text.length}/1000</small>
 </>;
}
