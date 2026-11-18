import {chatActivity} from '../../lib/chat';
import {NextResponse} from 'next/server';
import {FieldValue, type QueryDocumentSnapshot, type Timestamp} from 'firebase-admin/firestore';
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
function activityTime(value: unknown): number {
 if (value instanceof Date) return value.getTime();
 if (typeof value === 'string') return Date.parse(value) || 0;
 if (value && typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') return value.seconds * 1000;
 return 0;
}

export async function PATCH(request: Request) {
 try {
  const { adminDb, decoded } = await requireUser(request);
  const body = await request.json().catch(() => null);
  if (!validId(body?.id, 230)) return NextResponse.json({ error: 'Neplatná zpráva.' }, { status: 400, headers });

  const profileRef = adminDb.collection('users').doc(decoded.uid);
  const messageRef = adminDb.collection('communityChat').doc(body.id);
  await adminDb.runTransaction(async tx => {
   const [account, message] = await Promise.all([tx.get(profileRef), tx.get(messageRef)]);
   const readAt = message.data()?.createdAt as Timestamp | undefined;
   const previous = account.data()?.chatReadAt as Timestamp | undefined;
   if (!readAt || !account.exists || account.data()?.deleting || account.data()?.blocked) return;
   if (!previous || readAt.valueOf() > previous.valueOf()) tx.update(profileRef, { chatReadAt: readAt });
  });
  return NextResponse.json({ ok: true }, { headers });
 } catch (error) {
  return failure(error);
 }
}

export async function GET(request:Request){
 try{
  const {adminDb,decoded,profile}=await requireUser(request);
  const params=new URL(request.url).searchParams;
  if (params.get('view') === 'unread') {
   const meta = await adminDb.collection('chatMeta').doc('community').get();
   const readAt = profile?.data()?.chatReadAt as Timestamp | undefined;
   const enabled = profile?.data()?.socialNotifications?.chat !== false;
   const version = JSON.stringify([meta.data()?.revision || '', readAt?.seconds, readAt?.nanoseconds]);
   if (params.get('version') === version) return NextResponse.json({ version, enabled }, { headers });

   const messages = adminDb.collection('communityChat');
   const unreadQuery = (readAt ? messages.where('createdAt', '>', readAt) : messages)
    .orderBy('createdAt', 'desc').select('uid', 'deleted', 'createdAt').limit(100);
   let cursor: QueryDocumentSnapshot | undefined;
   let unread = 0;
   let newestIncomingAt = 0;
   do {
    const page = await (cursor ? unreadQuery.startAfter(cursor) : unreadQuery).get();
    for (const doc of page.docs) {
     const message = doc.data();
     if (message.deleted || message.uid === decoded.uid) continue;
     newestIncomingAt ||= message.createdAt.toMillis();
     if (++unread === 100) break;
    }
    cursor = page.size === 100 ? page.docs.at(-1) : undefined;
   } while (cursor && unread < 100);
   return NextResponse.json({ version, enabled, unread, newestIncomingAt }, { headers });
  }
  if(params.get('picker')==='activities'){
   // Equality-only query uses the existing index; sort before limiting to three.
   const mine=await adminDb.collection('runs').where('uid','==',decoded.uid).get();
   const activities = mine.docs
    .map(doc => ({ photos: chatActivity(doc.id, doc.data()), timestamp: doc.data().timestamp }))
    .filter(item => item.photos)
    .sort((a, b) => activityTime(b.timestamp) - activityTime(a.timestamp))
    .slice(0, 3)
    .map(item => item.photos);
   return NextResponse.json({activities},{headers});
  }
  const before=params.get('before');
  if(before&&!validId(before,230))return NextResponse.json({error:'Neplatná stránka chatu.'},{status:400,headers});
  const meta=await adminDb.collection('chatMeta').doc('community').get();
  const revision=String(meta.data()?.revision||'empty');
  if(!before&&new URL(request.url).searchParams.get('revision')===revision)return NextResponse.json({messages:[],unchanged:true,revision},{headers});
  const admin=decoded.admin===true||profile?.data()?.role==='admin';
  let query=adminDb.collection('communityChat').orderBy('createdAt','desc').limit(51);
  if(before){const cursor=await adminDb.collection('communityChat').doc(before).get();if(!cursor.exists)return NextResponse.json({error:'Starší zprávy se nepodařilo najít. Obnov chat.'},{status:400,headers});query=query.startAfter(cursor);}
  const snapshot=await query.get(),visible=snapshot.docs.slice(0,50);
  const attachments=new Map<string,ReturnType<typeof chatActivity>>();
  await Promise.all([...new Set(visible.filter(doc=>!doc.data().deleted).map(doc=>doc.data().activityId).filter((id):id is string=>validId(id,230)))].map(async id=>{const run=await adminDb.collection('runs').doc(id).get();attachments.set(id,run.exists?chatActivity(id,run.data()):null);}));
  const replies=new Map<string,{id:string;nickname:string;text:string}>();
  await Promise.all([...new Set(visible.filter(doc=>!doc.data().deleted).map(doc=>doc.data().reply?.id).filter((id):id is string=>validId(id,230)))].map(async id=>{const parent=await adminDb.collection('communityChat').doc(id).get();const data=parent.data();replies.set(id,{id,nickname:!data?.deleted?String(data?.nickname||'Uživatel'):'',text:!parent.exists||data?.deleted?'Původní zpráva byla odstraněna.':String(data?.text||'Sdílené fotky').slice(0,120)});}));
  const messages=visible.map(doc=>{const d=doc.data();return{id:doc.id,uid:String(d.uid||''),nickname:String(d.nickname||'Uživatel'),text:d.deleted?'':String(d.text||''),deleted:d.deleted===true,createdAt:d.createdAt?.toDate?.().toISOString()||null,canDelete:admin||d.uid===decoded.uid,activity:d.deleted?null:attachments.get(d.activityId)||null,activityUnavailable:!d.deleted&&!!d.activityId&&!attachments.get(d.activityId),reply:d.deleted?null:replies.get(d.reply?.id)||null};}).reverse();
  return NextResponse.json({messages,hasMore:snapshot.docs.length>50,cursor:visible.at(-1)?.id||null,revision},{headers});
 }catch(error){return failure(error);}
}
export async function POST(request:Request){
 try{
  const {adminDb,decoded}=await requireUser(request);
  const body=await request.json().catch(()=>null);
  const text=typeof body?.text==='string'?body.text.replace(/\r\n?/g,'\n').trim():'';
  if((!text&&!body?.activityId)||text.length>1000||!validId(body?.clientId)||(body?.activityId&&!validId(body.activityId,230))||(body?.replyTo&&!validId(body.replyTo,230)))return NextResponse.json({error:'Napiš zprávu o délce 1 až 1000 znaků.'},{status:400,headers});
  const message=adminDb.collection('communityChat').doc(`${decoded.uid}_${body.clientId}`);
  const rate=adminDb.collection('chatRateLimits').doc(decoded.uid);
  const result=await adminDb.runTransaction(async tx=>{
   const existing=await tx.get(message);
   if(existing.exists)return {id:message.id,duplicate:true};
   const recent=await tx.get(rate),profile=await tx.get(adminDb.collection('users').doc(decoded.uid));
   if(profile.data()?.blocked||profile.data()?.deleting)return {forbidden:true};
   let activityId:string|null=null,reply=null;
   if(body.activityId){const activity=await tx.get(adminDb.collection('runs').doc(body.activityId));if(!activity.exists||activity.data()?.deleting||activity.data()?.uid!==decoded.uid||!chatActivity(activity.id, activity.data()))return {invalidActivity:true};activityId=activity.id;}
   if(body.replyTo){const parent=await tx.get(adminDb.collection('communityChat').doc(body.replyTo));if(!parent.exists||parent.data()?.deleted)return {invalidReply:true};reply={id:parent.id};}
   const now=Date.now();
   if(now-Number(recent.data()?.lastSentAt||0)<3000)return {limited:true};
   const nickname=String(profile.data()?.nickname||'Uživatel').slice(0,40);
   tx.set(message,{uid:decoded.uid,nickname,text,activityId,reply,createdAt:FieldValue.serverTimestamp(),deleted:false});
   tx.set(rate,{lastSentAt:now});
   tx.set(adminDb.collection('chatMeta').doc('community'),{revision:message.id});
   return {id:message.id};
  });
  if('invalidActivity'in result)return NextResponse.json({error:'Sdílet můžeš jen fotky z vlastního záznamu.'},{status:400,headers});
  if('invalidReply'in result)return NextResponse.json({error:'Původní zpráva už není dostupná.'},{status:400,headers});
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
   tx.update(ref,{text:'',activityId:null,reply:null,deleted:true,deletedAt:FieldValue.serverTimestamp()});
   tx.set(adminDb.collection('chatMeta').doc('community'),{revision:ref.id+'_'+Date.now()});
   return 200;
  });
  return NextResponse.json(result===200?{ok:true}:{error:result===403?'Můžeš odstranit jen vlastní zprávu.':'Zpráva neexistuje.'},{status:result,headers});
 }catch(error){return failure(error);}
}
