import {randomUUID} from 'node:crypto';
import {chatActivity,chatPhotos,groupChatPhotos,MAX_CHAT_PHOTOS,type ChatPhotoSelection} from '../../lib/chat';
import {after,NextResponse} from 'next/server';
import {FieldValue, type QueryDocumentSnapshot, type Timestamp} from 'firebase-admin/firestore';
import {requireUser,authErrorResponse} from '../../lib/apiAuth';
import {chatPushReady, notifyChatDevices} from '../../lib/chatPush';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
const PAGE_SIZE = 30;
const REVISION_WINDOW = 32;
type ChatChange = { previous: string; revision: string; id: string };

function revisionOf(meta: FirebaseFirestore.DocumentData | undefined) {
 return String(meta?.revision || 'empty');
}

function changesIn(journal: FirebaseFirestore.DocumentData | undefined, revision: string): ChatChange[] {
 const changes: ChatChange[] = Array.isArray(journal?.changes) ? journal.changes : [];
 return changes.at(-1)?.revision === revision ? changes : [];
}

async function recordChange(tx: FirebaseFirestore.Transaction, db: FirebaseFirestore.Firestore, id: string) {
 const meta = db.collection('chatMeta').doc('community');
 const journal = db.collection('chatMeta').doc('changes');
 const [state, history] = await Promise.all([tx.get(meta), tx.get(journal)]);
 const previous = revisionOf(state.data());
 const revision = randomUUID();
 const changes = [...changesIn(history.data(), previous), { previous, revision, id }].slice(-REVISION_WINDOW);

 // Clients listen to the small revision document. Only the API reads the change history.
 tx.set(meta, { revision });
 tx.set(journal, { changes });
}
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
  const gallery = params.get('gallery');
  if (gallery !== null) {
   const unavailable = () => NextResponse.json({ error: 'Fotky už nejsou dostupné.' }, { status: 404, headers });
   if (!validId(gallery, 230)) return unavailable();
   const message = (await adminDb.collection('communityChat').doc(gallery).get()).data();
   if (!message || message.deleted) return unavailable();
   const requested = params.get('thumbnail');
   const activityId = params.get('activityId') || message.activityId;
   if (!requested || !validId(activityId, 230)) return unavailable();
   const allowed = Array.isArray(message.photos)
    ? message.photos.some((photo: ChatPhotoSelection) => photo.activityId === activityId && photo.thumbnail === requested)
    : activityId === message.activityId && (!message.thumbnail || requested === message.thumbnail);
   if (!allowed) return unavailable();
   const run = await adminDb.collection('runs').doc(activityId).get();
   const photos = chatPhotos(run.data());
   const index = photos.findIndex(photo => photo.thumbnail === requested);
   if (index < 0) return unavailable();
   return NextResponse.json({ images: photos.map(photo => photo.url), index }, { headers });
  }
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
  const meta = before ? undefined : (await adminDb.collection('chatMeta').doc('community').get()).data();
  const revision = revisionOf(meta);
  const since = params.get('revision');
  if (!before && since === revision) return NextResponse.json({ messages: [], unchanged: true, revision }, { headers });

  const admin = decoded.admin === true || profile?.data()?.role === 'admin';
  const collection = adminDb.collection('communityChat');
  let changes: string[] | null = null;
  if (!before && since) {
   const journal = await adminDb.collection('chatMeta').doc('changes').get();
   const history = changesIn(journal.data(), revision);
   const index = history.findIndex(change => change.previous === since);
   if (index >= 0) changes = [...new Set(history.slice(index).map(change => change.id))];
  }
  let visible: FirebaseFirestore.DocumentSnapshot[];
  let hasMore = false;
  if (changes) {
   visible = await Promise.all(changes.map(id => collection.doc(id).get()));
  } else {
   let query = collection.orderBy('createdAt', 'desc').limit(PAGE_SIZE + 1);
   if (before) {
    const cursor = await collection.doc(before).get();
    if (!cursor.exists) return NextResponse.json({ error: 'Starší zprávy se nepodařilo najít. Obnov chat.' }, { status: 400, headers });
    query = query.startAfter(cursor);
   }
   const snapshot = await query.get();
   hasMore = snapshot.size > PAGE_SIZE;
   visible = snapshot.docs.slice(0, PAGE_SIZE);
  }
  const activityIds = new Set<string>();
  for (const doc of visible) {
   const message = doc.data() || { deleted: true };
   if (message.deleted) continue;
   if (validId(message.activityId, 230)) activityIds.add(message.activityId);
   if (Array.isArray(message.photos)) {
    for (const photo of message.photos) if (validId(photo.activityId, 230)) activityIds.add(photo.activityId);
   }
  }
  const attachments = new Map<string, ReturnType<typeof chatActivity>>();
  const ids = [...activityIds];
  for (let i = 0; i < ids.length; i += 50) {
   await Promise.all(ids.slice(i, i + 50).map(async id => {
    const run = await adminDb.collection('runs').doc(id).get();
    attachments.set(id, chatActivity(id, run.data()));
   }));
  }
  const replies=new Map<string,{id:string;nickname:string;text:string}>();
  await Promise.all([...new Set(visible.filter(doc=>!doc.data()?.deleted).map(doc=>doc.data()?.reply?.id).filter((id):id is string=>validId(id,230)))].map(async id=>{const parent=await adminDb.collection('communityChat').doc(id).get();const data=parent.data();replies.set(id,{id,nickname:!data?.deleted?String(data?.nickname||'Uživatel'):'',text:!parent.exists||data?.deleted?'Původní zpráva byla odstraněna.':String(data?.text||'Sdílené fotky').slice(0,120)});}));
  const messages=visible.map(doc=>{
   const d=doc.data() || { deleted: true };
   const source = attachments.get(d.activityId);
   const activity = source && d.thumbnail
    ? (source.thumbnails.includes(d.thumbnail) ? { id: source.id, thumbnails: [d.thumbnail] } : null)
    : source;
   const selections: ChatPhotoSelection[] = Array.isArray(d.photos) && !d.deleted ? d.photos : [];
   const activities = groupChatPhotos(selections.filter(photo =>
    attachments.get(photo.activityId)?.thumbnails.includes(photo.thumbnail)
   ));
   return{id:doc.id,uid:String(d.uid||''),nickname:String(d.nickname||'Uživatel'),text:d.deleted?'':String(d.text||''),deleted:d.deleted===true,createdAt:d.createdAt?.toDate?.().toISOString()||null,canDelete:admin||d.uid===decoded.uid,activity:d.deleted?null:activity||null,activities,activityUnavailable:!d.deleted&&((!!d.activityId&&!activity)||activities.reduce((count,item)=>count+item.thumbnails.length,0)<selections.length),reply:d.deleted?null:replies.get(d.reply?.id)||null};}).reverse();
  return NextResponse.json({
   messages, hasMore, cursor: changes ? null : visible.at(-1)?.id || null,
   ...(before ? {} : { revision, delta: changes !== null }),
  }, { headers });
 }catch(error){return failure(error);}
}
export async function POST(request:Request){
 try{
  const {adminDb,decoded}=await requireUser(request);
  const body=await request.json().catch(()=>null);
  const text=typeof body?.text==='string'?body.text.replace(/\r\n?/g,'\n').trim():'';
  const photos: unknown = body?.photos;
  const validSelection = (value: unknown): value is ChatPhotoSelection => {
   if (!value || typeof value !== 'object' || !('activityId' in value) || !('thumbnail' in value)) return false;
   return validId(value.activityId, 230) && typeof value.thumbnail === 'string' && !!value.thumbnail && value.thumbnail.length <= 2048;
  };
  if (photos !== undefined && (!Array.isArray(photos) || photos.length > MAX_CHAT_PHOTOS ||
      !photos.every(validSelection) || body.activityId !== undefined || body.thumbnail !== undefined)) {
   return NextResponse.json({ error: 'Neplatný výběr fotek.' }, { status: 400, headers });
  }
  const selections: ChatPhotoSelection[] = Array.isArray(photos)
   ? [...new Map<string, ChatPhotoSelection>(photos.map(photo => [JSON.stringify([photo.activityId, photo.thumbnail]), { activityId: photo.activityId, thumbnail: photo.thumbnail }])).values()]
   : [];
  if((!text&&!body?.activityId&&!selections.length)||text.length>1000||!validId(body?.clientId)||(body?.activityId&&!validId(body.activityId,230))||(body?.replyTo&&!validId(body.replyTo,230)))return NextResponse.json({error:'Napiš zprávu o délce 1 až 1000 znaků.'},{status:400,headers});
  const thumbnail = body?.thumbnail;
  if (thumbnail !== undefined && (!body?.activityId || typeof thumbnail !== 'string' || thumbnail.length > 2048)) {
   return NextResponse.json({ error: 'Neplatný výběr fotky.' }, { status: 400, headers });
  }
  const message=adminDb.collection('communityChat').doc(`${decoded.uid}_${body.clientId}`);
  const rate=adminDb.collection('chatRateLimits').doc(decoded.uid);
  const result=await adminDb.runTransaction(async tx=>{
   const existing=await tx.get(message);
   if(existing.exists)return {id:message.id,duplicate:true};
   const recent=await tx.get(rate),profile=await tx.get(adminDb.collection('users').doc(decoded.uid));
   if(profile.data()?.blocked||profile.data()?.deleting)return {forbidden:true};
   let activityId:string|null=null,reply=null;
   if (body.activityId) {
    const activity = await tx.get(adminDb.collection('runs').doc(body.activityId));
    const photos = chatActivity(activity.id, activity.data());
    if (!photos || activity.data()?.uid !== decoded.uid || (thumbnail !== undefined && !photos.thumbnails.includes(thumbnail))) {
     return { invalidActivity: true };
    }
    activityId = activity.id;
   }
   for (const group of groupChatPhotos(selections)) {
    const record = await tx.get(adminDb.collection('runs').doc(group.id));
    const available = chatActivity(group.id, record.data());
    if (!available || record.data()?.uid !== decoded.uid ||
        !group.thumbnails.every(thumbnail => available.thumbnails.includes(thumbnail))) {
     return { invalidActivity: true };
    }
   }
   if(body.replyTo){const parent=await tx.get(adminDb.collection('communityChat').doc(body.replyTo));if(!parent.exists||parent.data()?.deleted)return {invalidReply:true};reply={id:parent.id};}
   const now=Date.now();
   if(now-Number(recent.data()?.lastSentAt||0)<3000)return {limited:true};
   await recordChange(tx, adminDb, message.id);
   const nickname=String(profile.data()?.nickname||'Uživatel').slice(0,40);
   tx.set(message,{uid:decoded.uid,nickname,text,activityId,thumbnail:thumbnail ?? null,photos:selections.length ? selections : null,reply,createdAt:FieldValue.serverTimestamp(),deleted:false});
   tx.set(rate,{lastSentAt:now});
   return {id:message.id};
  });
  if('invalidActivity'in result)return NextResponse.json({error:'Sdílet můžeš jen fotky z vlastního záznamu.'},{status:400,headers});
  if('invalidReply'in result)return NextResponse.json({error:'Původní zpráva už není dostupná.'},{status:400,headers});
  if('forbidden'in result)return NextResponse.json({error:'Tento účet nemůže odesílat zprávy.'},{status:403,headers});
  if('limited'in result)return NextResponse.json({error:'Před další zprávou chvíli počkej.'},{status:429,headers:{...headers,'Retry-After':'3'}});
  if (!('duplicate' in result) && chatPushReady()) {
   after(() => notifyChatDevices(adminDb, decoded.uid).catch(error => console.error('Chat push delivery failed', error)));
  }
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
   if (message.data()?.deleted) return 200;
   await recordChange(tx, adminDb, ref.id);
   tx.update(ref,{text:'',activityId:null,thumbnail:null,photos:null,reply:null,deleted:true,deletedAt:FieldValue.serverTimestamp()});
   return 200;
  });
  return NextResponse.json(result===200?{ok:true}:{error:result===403?'Můžeš odstranit jen vlastní zprávu.':'Zpráva neexistuje.'},{status:result,headers});
 }catch(error){return failure(error);}
}
