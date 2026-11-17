import {NextResponse} from 'next/server';
import {FieldValue} from 'firebase-admin/firestore';
import {requireUser,authErrorResponse} from '../../lib/apiAuth';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const validId=(value:unknown,max=100):value is string=>typeof value==='string'&&value.length<=max&&/^[a-zA-Z0-9_-]+$/.test(value);
function failure(error:unknown){
 const auth=authErrorResponse(error);
 if(auth)return NextResponse.json({error:auth.message},{status:auth.status,headers});
 console.error('Chat request failed',error);
 return NextResponse.json({error:'Chat se nepodařilo načíst nebo uložit. Zkus to znovu.'},{status:500,headers});
}
export async function GET(request:Request){
 try{
  const {adminDb,decoded}=await requireUser(request);
  const before=new URL(request.url).searchParams.get('before');
  if(before&&!validId(before,230))return NextResponse.json({error:'Neplatná stránka chatu.'},{status:400,headers});
  const meta=await adminDb.collection('chatMeta').doc('community').get();
  const revision=String(meta.data()?.revision||'empty');
  if(!before&&new URL(request.url).searchParams.get('revision')===revision)return NextResponse.json({messages:[],unchanged:true,revision},{headers});
  const profile=await adminDb.collection('users').doc(decoded.uid).get();
  const admin=decoded.admin===true||profile.data()?.role==='admin';
  let query=adminDb.collection('communityChat').orderBy('createdAt','desc').limit(51);
  if(before){const cursor=await adminDb.collection('communityChat').doc(before).get();if(!cursor.exists)return NextResponse.json({error:'Starší zprávy se nepodařilo najít. Obnov chat.'},{status:400,headers});query=query.startAfter(cursor);}
  const snapshot=await query.get(),visible=snapshot.docs.slice(0,50);
  const messages=visible.map(doc=>{const d=doc.data();return{id:doc.id,uid:String(d.uid||''),nickname:String(d.nickname||'Uživatel'),text:d.deleted?'':String(d.text||''),deleted:d.deleted===true,createdAt:d.createdAt?.toDate?.().toISOString()||null,canDelete:admin||d.uid===decoded.uid};}).reverse();
  return NextResponse.json({messages,hasMore:snapshot.docs.length>50,cursor:visible.at(-1)?.id||null,revision},{headers});
 }catch(error){return failure(error);}
}
export async function POST(request:Request){
 try{
  const {adminDb,decoded}=await requireUser(request);
  const body=await request.json().catch(()=>null);
  const text=typeof body?.text==='string'?body.text.replace(/\r\n?/g,'\n').trim():'';
  if(!text||text.length>1000||!validId(body?.clientId))return NextResponse.json({error:'Napiš zprávu o délce 1 až 1000 znaků.'},{status:400,headers});
  const message=adminDb.collection('communityChat').doc(`${decoded.uid}_${body.clientId}`);
  const rate=adminDb.collection('chatRateLimits').doc(decoded.uid);
  const result=await adminDb.runTransaction(async tx=>{
   const existing=await tx.get(message);
   if(existing.exists)return {id:message.id,duplicate:true};
   const recent=await tx.get(rate),profile=await tx.get(adminDb.collection('users').doc(decoded.uid));
   if(profile.data()?.blocked||profile.data()?.deleting)return {forbidden:true};
   const now=Date.now();
   if(now-Number(recent.data()?.lastSentAt||0)<3000)return {limited:true};
   const nickname=String(profile.data()?.nickname||'Uživatel').slice(0,40);
   tx.set(message,{uid:decoded.uid,nickname,text,createdAt:FieldValue.serverTimestamp(),deleted:false});
   tx.set(rate,{lastSentAt:now});
   tx.set(adminDb.collection('chatMeta').doc('community'),{revision:message.id});
   return {id:message.id};
  });
  if('forbidden'in result)return NextResponse.json({error:'Tento účet nemůže odesílat zprávy.'},{status:403,headers});
  if('limited'in result)return NextResponse.json({error:'Před další zprávou chvíli počkej.'},{status:429,headers:{...headers,'Retry-After':'3'}});
  return NextResponse.json({ok:true,...result},{headers});
 }catch(error){return failure(error);}
}
export async function DELETE(request:Request){
 try{
  const {adminDb,decoded}=await requireUser(request);
  const body=await request.json().catch(()=>null);
  // Message IDs include the Firebase user ID and a random request ID.
  if(!validId(body?.id,230))return NextResponse.json({error:'Neplatná zpráva.'},{status:400,headers});
  const ref=adminDb.collection('communityChat').doc(body.id);
  const result=await adminDb.runTransaction(async tx=>{
   const message=await tx.get(ref),profile=await tx.get(adminDb.collection('users').doc(decoded.uid));
   if(!message.exists)return 404;
   if(message.data()?.uid!==decoded.uid&&profile.data()?.role!=='admin'&&decoded.admin!==true)return 403;
   tx.update(ref,{text:'',deleted:true,deletedAt:FieldValue.serverTimestamp()});
   tx.set(adminDb.collection('chatMeta').doc('community'),{revision:ref.id+'_'+Date.now()});
   return 200;
  });
  return NextResponse.json(result===200?{ok:true}:{error:result===403?'Můžeš odstranit jen vlastní zprávu.':'Zpráva neexistuje.'},{status:result,headers});
 }catch(error){return failure(error);}
}
