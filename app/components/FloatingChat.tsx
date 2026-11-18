"use client";
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {usePathname,useRouter} from 'next/navigation';
import {onAuthStateChanged} from 'firebase/auth';
import {MessageCircle} from 'lucide-react';
import {auth} from '../lib/firebase';
export default function FloatingChat(){
 const [visible,setVisible]=useState(false),router=useRouter(),path=usePathname();
 useEffect(()=>onAuthStateChanged(auth,user=>setVisible(!!user)),[]);
 if(!visible||path==='/login')return null;
 return createPortal(<button type="button" className={`floating-chat${path==='/chat'?' is-active':''}`} aria-label={path==='/chat'?'Napsat zprávu do chatu':'Otevřít společný chat'} title="Společný chat" onClick={()=>{if(path==='/chat'){const input=document.getElementById('chat-text');input?.scrollIntoView({block:'center'});input?.focus();}else router.push('/chat');}}><MessageCircle size={26}/></button>,document.body);
}
