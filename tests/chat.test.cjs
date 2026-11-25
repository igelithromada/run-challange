const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const photo = 'https://res.cloudinary.com/example/image/upload/v1/photo.jpg';
const serverModules = {};
for (const name of ['runData', 'chat', 'chatAvailability']) {
 const module = {exports:{}};
 const code = ts.transpileModule(fs.readFileSync('app/lib/'+name+'.ts','utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
 }).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,Date,require:n=>n==='./runData'?serverModules.runData:require(n)});
 serverModules[name] = module.exports;
}
function setup(){
 const docs=new Map([['users/member',{nickname:'Radek',role:'user'}],['users/other',{nickname:'Verča',role:'user'}],['users/admin',{nickname:'Správce',role:'admin'}]]);let uid='member',unauthorized=false,writes=0;
 const snapshot=path=>({id:path.split('/').at(-1),exists:docs.has(path),data:()=>docs.get(path)});
 const ref=path=>({id:path.split('/').at(-1),path,get:async()=>snapshot(path)});
 const query = (name, {where, count=Infinity, after} = {}) => ({
  doc: id => ref(name+'/'+id),
  where: (field, op, value) => query(name,{where: [field, op, value], count, after}),
  orderBy: () => query(name,{where,count,after}),
  select: () => query(name,{where,count,after}),
  limit: count => query(name,{where,count,after}),
  startAfter: after => query(name,{where,count,after}),
  get: async () => {
   let rows = [...docs.keys()].filter(path => path.startsWith(name+'/')).map(snapshot);
   if (where) {
    const [field, op, value] = where;
    rows = rows.filter(row => op === '==' ? row.data()[field] === value : row.data()[field].valueOf() > value.valueOf());
   }
   if (name==='runs') rows = rows.filter(row=>row.data().timestamp).sort((a,b)=>+b.data().timestamp - +a.data().timestamp);
   if (name==='communityChat') rows.sort((a,b)=>b.data().createdAt.toMillis()-a.data().createdAt.toMillis());
   if (after) rows=rows.slice(rows.findIndex(row=>row.id===after.id)+1);
   rows=rows.slice(0,count);
   return {docs:rows,size:rows.length};
  }
 });
 const db={collection:query,getAll:async(...refs)=>refs.map(ref=>snapshot(ref.path)),runTransaction:async fn=>fn({get:async r=>snapshot(r.path),set:(r,d,options)=>{writes++;docs.set(r.path,options?.merge?{...docs.get(r.path),...d}:d)},update:(r,d)=>{writes++;docs.set(r.path,{...docs.get(r.path),...d})}})};

 const module={exports:{}},file='app/api/chat/route.ts';const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:n=>n==='../../lib/chatAvailability'?serverModules.chatAvailability:n==='../../lib/chatPush'?{chatPushReady:()=>false}:n==='../../lib/chat'?serverModules.chat:n==='../../lib/runData'?serverModules.runData:n==='next/server'?{NextResponse:{json:(data,options)=>Response.json(data,options)}}:n==='firebase-admin/firestore'?{FieldValue:{serverTimestamp:()=>{const date=new Date();return {toDate:()=>date,toMillis:()=>+date,valueOf:()=>+date,seconds:Math.floor(+date/1000),nanoseconds:(+date%1000)*1000000}}}}:n==='../../lib/apiAuth'?{requireUser:async()=>{if(unauthorized)throw new Error('auth');if(docs.get('users/'+uid)?.blocked)throw new Error('blocked');return{decoded:{uid},adminDb:db,profile:snapshot('users/'+uid)}},authErrorResponse:e=>e.message==='auth'?{message:'Nejsi přihlášen.',status:401}:e.message==='blocked'?{message:'Blokováno',status:403}:null}:require(n),Date,URL,console});
 const api=module.exports,request=(method,body,query='')=>api[method](new Request('https://example.com/api/chat'+query,{method,...(method==='GET'?{}:{body:JSON.stringify(body)})}));return{docs,request,user:u=>uid=u,deny:()=>unauthorized=true,writes:()=>writes};
}
test('chat rejects unauthenticated access and blocked senders',async()=>{const s=setup();s.deny();for(const method of ['GET','POST','DELETE','PATCH'])assert.equal((await s.request(method,{})).status,401);const b=setup();b.docs.get('users/member').blocked=true;assert.equal((await b.request('POST',{text:'Zpráva',clientId:'one'})).status,403);});
test('chat validates text and IDs and takes author identity only from the verified profile',async()=>{const s=setup();for(const text of ['','  ','x'.repeat(1001)])assert.equal((await s.request('POST',{text,clientId:'one'})).status,400);assert.equal((await s.request('POST',{text:'Ahoj',clientId:'../bad'})).status,400);const res=await s.request('POST',{text:' Ahoj\r\nkomunito ',clientId:'one',uid:'admin',nickname:'Podvrh'});assert.equal(res.status,200);const row=s.docs.get('communityChat/member_one');assert.equal(row.uid,'member');assert.equal(row.nickname,'Radek');assert.equal(row.text,'Ahoj\nkomunito');});
test('chat deduplicates retry requests and rate limits a different message',async()=>{const s=setup(),body={text:'Ahoj',clientId:'one'};await s.request('POST',body);const writes=s.writes();assert.equal((await s.request('POST',body)).status,200);assert.equal(s.writes(),writes);const limited=await s.request('POST',{text:'Další',clientId:'two'});assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'3');assert.equal(s.docs.has('communityChat/member_two'),false);});
test('only author or admin can retract a message; tombstones erase text but retain ordering',async()=>{const s=setup();await s.request('POST',{text:'Ahoj',clientId:'one'});s.user('other');assert.equal((await s.request('DELETE',{id:'member_one'})).status,403);assert.equal(s.docs.get('communityChat/member_one').text,'Ahoj');s.user('admin');assert.equal((await s.request('DELETE',{id:'member_one'})).status,200);assert.equal(s.docs.get('communityChat/member_one').deleted,true);assert.equal(s.docs.get('communityChat/member_one').text,'');assert.ok(s.docs.get('communityChat/member_one').createdAt);});
test('chat returns safe chronological messages and does not expose internal fields',async()=>{const s=setup();await s.request('POST',{text:'<script>text only</script>',clientId:'one'});const response=await s.request('GET');assert.equal(response.headers.get('cache-control'),'private, no-store');const data=await response.json();assert.equal(data.messages.length,1);assert.equal(data.messages[0].canDelete,true);assert.equal(data.messages[0].text,'<script>text only</script>');assert.equal(data.hasMore,false);assert.equal((await s.request('GET',null,'?before=../bad')).status,400);});
test('unchanged chat polling returns only a revision and does not resend history',async()=>{const s=setup();await s.request('POST',{text:'Ahoj',clientId:'one'});const first=await(await s.request('GET')).json();const next=await(await s.request('GET',null,'?revision='+encodeURIComponent(first.revision))).json();assert.equal(next.unchanged,true);assert.deepEqual(next.messages,[]);});

test('activity picker uses the same recent public feed and keeps photos and private fields out',async()=>{
 const s=setup();
 for(let i=1;i<=31;i++) s.docs.set('runs/r'+i,{uid:'member',type:'běh',km:i,timestamp:new Date(2026,0,i),imageUrls:[photo],email:'private'});
 s.docs.set('runs/deleting',{uid:'member',deleting:true,timestamp:new Date(2026,1,7)});
 s.docs.set('runs/foreign',{uid:'other',nickname:'Verča',type:'kliky',repetitions:20,timestamp:new Date(2026,1,6)});
 const avatarUrl = 'https://res.cloudinary.com/example/image/upload/v1/avatar.jpg';
 s.docs.set('publicProfiles/other',{avatarUrl});
 const {records}=await(await s.request('GET',null,'?picker=records')).json();
 assert.equal(records[0].avatarUrl, avatarUrl);
 assert.equal(records.length,29);
 assert.deepEqual(records.slice(0,3).map(r=>r.id),['foreign','r31','r30']);
 assert.equal(records[0].repetitions,20);
 assert.equal(records[0].nickname,'Verča');
 assert.equal(records.at(-1).id,'r4');
 assert.ok(!JSON.stringify(records).includes(photo));
 assert.ok(!JSON.stringify(records).includes('private'));
});

test('sharing any visible record uses live metrics and works with or without text',async()=>{
 const s=setup();
 s.docs.set('runs/foreign',{uid:'other',nickname:'Verča',type:'dřepy',repetitions:45,imageUrl:photo});
 s.docs.set('runs/deleting',{uid:'member',deleting:true});
 for (const activityId of ['missing','deleting','../foreign']) {
  assert.equal((await s.request('POST',{activityId,clientId:'bad'})).status,400);
 }
 assert.equal((await s.request('POST',{activityId:'foreign',clientId:'one',activity:{amount:999}})).status,200);
 let data=await(await s.request('GET')).json();
 assert.equal(data.messages[0].records[0].repetitions,45);
 assert.equal(data.messages[0].records[0].nickname,'Verča');
 assert.deepEqual(data.messages[0].records.map(record=>record.id),['foreign']);
 assert.ok(!JSON.stringify(data).includes(photo));
 s.docs.get('runs/foreign').repetitions=56;
 s.user('other');
 assert.equal((await s.request('POST',{activityId:'foreign',clientId:'two',text:'Dobrý výkon!'})).status,200);
 data=await(await s.request('GET')).json();
 const withText = data.messages.find(message => message.id === 'other_two');
 assert.equal(withText.records[0].repetitions,56);
 assert.equal(withText.text,'Dobrý výkon!');
 s.docs.delete('runs/foreign');
 data=await(await s.request('GET')).json();
 assert.equal(data.messages[0].activityUnavailable,true);
 assert.deepEqual(data.messages[0].records,[]);
});
test('replies resolve the original message and respect its later deletion',async()=>{
 const s=setup();await s.request('POST',{text:'Původní text',clientId:'one'});s.user('other');
 assert.equal((await s.request('POST',{text:'Reakce',replyTo:'missing',clientId:'bad'})).status,400);
 await s.request('POST',{text:'Reakce',replyTo:'member_one',clientId:'two'});
 let data=await(await s.request('GET')).json();assert.equal(data.messages.find(m=>m.id==='other_two').reply.text,'Původní text');
 s.user('member');await s.request('DELETE',{id:'member_one'});
 data=await(await s.request('GET')).json();assert.equal(data.messages.find(m=>m.id==='other_two').reply.text,'Původní zpráva byla odstraněna.');
});

test('unread chat status counts others, honors settings, and keeps the read marker monotonic', async () => {
 const s = setup();
 const stamp = seconds => ({seconds,nanoseconds:0,toMillis:()=>seconds*1000,valueOf:()=>seconds});
 s.docs.set('communityChat/a',{uid:'other',createdAt:stamp(1)});
 s.docs.set('communityChat/b',{uid:'member',createdAt:stamp(2)});
 s.docs.set('communityChat/c',{uid:'other',createdAt:stamp(3),deleted:true});
 s.docs.set('communityChat/d',{uid:'other',createdAt:stamp(4)});
 s.docs.get('users/member').socialNotifications={chat:false};
 const status = async (version = '') => (await s.request('GET',null,'?view=unread&version='+encodeURIComponent(version))).json();
 const initial = await status();
 assert.equal(initial.unread,2);
 assert.equal(initial.enabled,false);
 assert.equal((await status(initial.version)).unread,undefined);
 await s.request('PATCH',{id:'b'});
 await s.request('PATCH',{id:'a'});
 assert.equal((await status(initial.version)).unread,1);
 await s.request('PATCH',{id:'d'});
 assert.equal((await status()).unread,0);
 s.user('other');
 assert.equal((await status()).unread,1);
});


test('the retired photo picker and gallery never return photos',async()=>{
 const s=setup();
 assert.deepEqual(await(await s.request('GET',null,'?picker=activities')).json(),{activities:[]});
 assert.equal((await s.request('GET',null,'?gallery=member_one')).status,404);
 assert.equal((await s.request('POST',{activityId:'r',thumbnail:photo,clientId:'one'})).status,400);
 assert.equal((await s.request('POST',{photos:[{activityId:'r',thumbnail:photo}],clientId:'two'})).status,400);
 assert.equal((await s.request('POST',{photos:[],text:'Zpráva ze starší verze',clientId:'three'})).status,200);
});

test('live chat sends revision changes over an authenticated stream and releases its listener on cancellation', async () => {
 let update, detached = false, deny = true;
 const live = { exports: {} };
 const code = ts.transpileModule(fs.readFileSync('app/api/chat/events/route.ts','utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
 }).outputText;
 vm.runInNewContext(code, { module:live, exports:live.exports, Response, ReadableStream, TextEncoder,
  setTimeout, clearTimeout, setInterval, clearInterval,
  require: name => name.endsWith('chatAvailability') ? serverModules.chatAvailability : ({
   authErrorResponse: () => ({status:401}),
   requireUser: async () => {
    if (deny) throw Error('auth');
    return {adminDb:{collection:()=>({doc:()=>({
     get: async () => ({data:()=>undefined}),
     onSnapshot: callback => { update=callback; return ()=>{detached=true}; },
    })})}};
   },
  }),
 });
 const request = new Request('https://example.com/api/chat/events');
 assert.equal((await live.exports.GET(request)).status,401);
 deny = false;
 const response = await live.exports.GET(request);
 assert.match(response.headers.get('content-type'), /text\/event-stream/);
 const reader = response.body.getReader();
 try {
  const decoder = new TextDecoder();
  for (const revision of ['initial', 'new-message']) {
   update({ data:()=>({revision}) });
   assert.equal(decoder.decode((await reader.read()).value), 'data: '+JSON.stringify(revision)+'\n\n');
  }
 } finally {
  await reader.cancel();
 }
 assert.equal(detached,true);
});

test('legacy photo messages resolve distinct records without exposing their thumbnails',async()=>{
 const s=setup();
 s.docs.set('runs/one',{uid:'member',km:3,imageUrls:[photo]});
 s.docs.set('runs/two',{uid:'member',km:4});
 await s.request('POST',{text:'Původní komentář',clientId:'one'});
 const message = s.docs.get('communityChat/member_one');
 message.activityId='one';
 message.thumbnail=photo;
 message.photos=[{activityId:'one',thumbnail:photo},{activityId:'two',thumbnail:photo},null];
 s.user('other');
 const feed=await(await s.request('GET')).json();
 assert.equal(feed.messages[0].text,'Původní komentář');
 assert.deepEqual(feed.messages[0].records.map(record=>record.id),['one','two']);
 assert.ok(!JSON.stringify(feed).includes(photo));
 s.docs.delete('runs/one');
 const updated=await(await s.request('GET')).json();
 assert.deepEqual(updated.messages[0].records.map(record=>record.id),['two']);
 assert.equal(updated.messages[0].activityUnavailable,true);
});

test('chat reads 30 messages per page and refreshes only the changed messages', async () => {
 const s = setup();
 for (let i = 1; i <= 65; i++) {
  const date = new Date(2026, 0, 1, 0, 0, i);
  s.docs.set('communityChat/history_' + i, {
   uid: 'other', nickname: 'Verča', text: String(i), deleted: false,
   createdAt: { toMillis: () => +date, toDate: () => date },
  });
 }
 const get = async params => (await s.request('GET', null, '?' + new URLSearchParams(params))).json();
 const recent = await get({});
 assert.equal(recent.messages.length, 30);
 assert.equal(recent.messages[0].text, '36');
 assert.equal(recent.hasMore, true);
 const older = await get({ before: recent.cursor });
 assert.equal(older.messages.length, 30);
 assert.equal(older.messages[0].text, '6');
 const oldest = await get({ before: older.cursor });
 assert.equal(oldest.messages.length, 5);
 assert.equal(oldest.hasMore, false);

 assert.equal((await s.request('POST', { text: 'Nová zpráva', clientId: 'delta' })).status, 200);
 s.user('other');
 assert.equal((await s.request('DELETE', { id: 'history_3' })).status, 200);
 const changes = await get({ revision: recent.revision });
 assert.equal(changes.delta, true);
 assert.deepEqual(changes.messages.map(row => [row.id, row.deleted]), [['history_3', true], ['member_delta', false]]);
 assert.equal((await get({ revision: 'unknown-old-cursor' })).messages.length, 30);

});

test('disabling chat blocks reads and writes for everyone and preserves history', async () => {
 const s = setup();
 await s.request('POST', {text:'Zpráva', clientId:'one'});
 const path = 'chatMeta/community';
 const state = s.docs.get(path);
 s.docs.set(path, {...state, enabled:false});
 s.user('admin');
 for (const query of ['', '?picker=records', '?view=unread']) {
  assert.equal((await s.request('GET', null, query)).status, 403);
 }
 for (const method of ['POST', 'PATCH', 'DELETE']) {
  assert.equal((await s.request(method, {id:'member_one', text:'Další', clientId:'two'})).status, 403);
 }
 s.docs.set(path, {...state, enabled:true});
 assert.equal((await (await s.request('GET')).json()).messages[0].text, 'Zpráva');
 await s.request('POST', {text:'Další', clientId:'two'});
 assert.equal(s.docs.get(path).enabled, true);
});
