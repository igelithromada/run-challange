import {randomUUID} from 'node:crypto';
import {chatRecord,type ChatRecord} from '../../lib/chat';
import {mergeActivityFeed,RECENT_ACTIVITY_LIMIT} from '../../lib/runData';
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
function attachedRecordIds(message: FirebaseFirestore.DocumentData): string[] {
 if (message.deleted) return [];
 const ids = Array.isArray(message.photos) ? message.photos.map(photo => photo?.activityId) : [];
 return [...new Set([message.activityId, ...ids].filter(id => validId(id, 230)))];
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
  if (params.has('gallery')) return NextResponse.json({ error: 'Chat už fotky nesdílí.' }, { status: 404, headers });
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
  if (params.get('picker') === 'activities') return NextResponse.json({ activities: [] }, { headers });
  if (params.get('picker') === 'records') {
   const snapshot = await adminDb.collection('runs').orderBy('timestamp', 'desc').limit(RECENT_ACTIVITY_LIMIT).get();
   const recent = mergeActivityFeed([], snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
   return NextResponse.json({
    records: recent.map(run => chatRecord(run.id, run)).filter(record => record !== null),
   }, { headers });
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
  const records = new Map<string, ChatRecord>();
  const ids = [...new Set(visible.flatMap(doc => attachedRecordIds(doc.data() ?? {})))];
  for (let i = 0; i < ids.length; i += 50) {
   const batch = await Promise.all(ids.slice(i, i + 50).map(id => adminDb.collection('runs').doc(id).get()));
   for (const run of batch) {
    const record = chatRecord(run.id, run.data());
    if (record) records.set(run.id, record);
   }
  }
  const replies=new Map<string,{id:string;nickname:string;text:string}>();
  await Promise.all([...new Set(visible.filter(doc=>!doc.data()?.deleted).map(doc=>doc.data()?.reply?.id).filter((id):id is string=>validId(id,230)))].map(async id=>{const parent=await adminDb.collection('communityChat').doc(id).get();const data=parent.data();replies.set(id,{id,nickname:!data?.deleted?String(data?.nickname||'Uživatel'):'',text:!parent.exists||data?.deleted?'Původní zpráva byla odstraněna.':String(data?.text||'Sdílený záznam').slice(0,120)});}));
  const messages=visible.map(doc=>{
   const d=doc.data() || { deleted: true };
   const attachedIds = attachedRecordIds(d);
   const attachments = attachedIds.flatMap(id => {
    const record = records.get(id);
    return record ? [record] : [];
   });
   return {
    id: doc.id, uid: String(d.uid || ''), nickname: String(d.nickname || 'Uživatel'),
    text: d.deleted ? '' : String(d.text || ''), deleted: d.deleted === true,
    createdAt: d.createdAt?.toDate?.().toISOString() || null, canDelete: admin || d.uid === decoded.uid,
    records: attachments, activityUnavailable: attachments.length < attachedIds.length,
    reply: d.deleted ? null : replies.get(d.reply?.id) || null,
   };
  }).reverse();
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
  const activityId = body?.activityId;
  if (body?.thumbnail !== undefined || (body?.photos !== undefined && (!Array.isArray(body.photos) || body.photos.length > 0))) {
   return NextResponse.json({ error: 'Fotky už nelze sdílet. Obnov stránku chatu a vyber záznam.' }, { status: 400, headers });
  }
  if (activityId != null && !validId(activityId, 230)) {
   return NextResponse.json({ error: 'Neplatný záznam.' }, { status: 400, headers });
  }
  if ((!text && !activityId) || text.length > 1000 || !validId(body?.clientId) || (body?.replyTo && !validId(body.replyTo, 230))) {
   return NextResponse.json({ error: 'Napiš zprávu o délce 1 až 1000 znaků nebo připoj záznam.' }, { status: 400, headers });
  }
  const message=adminDb.collection('communityChat').doc(`${decoded.uid}_${body.clientId}`);
  const rate=adminDb.collection('chatRateLimits').doc(decoded.uid);
  const result=await adminDb.runTransaction(async tx=>{
   const existing=await tx.get(message);
   if(existing.exists)return {id:message.id,duplicate:true};
   const recent=await tx.get(rate),profile=await tx.get(adminDb.collection('users').doc(decoded.uid));
   if(profile.data()?.blocked||profile.data()?.deleting)return {forbidden:true};
   let reply = null;
   if (activityId) {
    const activity = await tx.get(adminDb.collection('runs').doc(activityId));
    if (!chatRecord(activity.id, activity.data())) return { invalidActivity: true };
   }
   if(body.replyTo){const parent=await tx.get(adminDb.collection('communityChat').doc(body.replyTo));if(!parent.exists||parent.data()?.deleted)return {invalidReply:true};reply={id:parent.id};}
   const now=Date.now();
   if(now-Number(recent.data()?.lastSentAt||0)<3000)return {limited:true};
   await recordChange(tx, adminDb, message.id);
   const nickname=String(profile.data()?.nickname||'Uživatel').slice(0,40);
   tx.set(message,{uid:decoded.uid,nickname,text,activityId:activityId ?? null,reply,createdAt:FieldValue.serverTimestamp(),deleted:false});
   tx.set(rate,{lastSentAt:now});
   return {id:message.id};
  });
  if('invalidActivity'in result)return NextResponse.json({error:'Tento záznam už není dostupný.'},{status:400,headers});
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
