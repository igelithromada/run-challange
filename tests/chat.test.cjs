const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const imageModule={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/lib/imageUrl.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:imageModule,exports:imageModule.exports,URL});
const photo = 'https://res.cloudinary.com/example/image/upload/v1/photo.jpg';
const projectionModule={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/lib/chat.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:projectionModule,exports:projectionModule.exports,Date,require:n=>n==='./imageUrl'?imageModule.exports:require(n)});
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
   if (name==='communityChat') rows.sort((a,b)=>b.data().createdAt.toMillis()-a.data().createdAt.toMillis());
   if (after) rows=rows.slice(rows.findIndex(row=>row.id===after.id)+1);
   rows=rows.slice(0,count);
   return {docs:rows,size:rows.length};
  }
 });
 const db={collection:query,runTransaction:async fn=>fn({get:async r=>snapshot(r.path),set:(r,d)=>{writes++;docs.set(r.path,d)},update:(r,d)=>{writes++;docs.set(r.path,{...docs.get(r.path),...d})}})};

 const module={exports:{}},file='app/api/chat/route.ts';const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:n=>n==='../../lib/chat'?projectionModule.exports:n==='next/server'?{NextResponse:{json:(data,options)=>Response.json(data,options)}}:n==='firebase-admin/firestore'?{FieldValue:{serverTimestamp:()=>{const date=new Date();return {toDate:()=>date,toMillis:()=>+date,valueOf:()=>+date,seconds:Math.floor(+date/1000),nanoseconds:(+date%1000)*1000000}}}}:n==='../../lib/apiAuth'?{requireUser:async()=>{if(unauthorized)throw new Error('auth');if(docs.get('users/'+uid)?.blocked)throw new Error('blocked');return{decoded:{uid},adminDb:db,profile:snapshot('users/'+uid)}},authErrorResponse:e=>e.message==='auth'?{message:'Nejsi přihlášen.',status:401}:e.message==='blocked'?{message:'Blokováno',status:403}:null}:require(n),Date,URL,console});
 const api=module.exports,request=(method,body,query='')=>api[method](new Request('https://example.com/api/chat'+query,{method,...(method==='GET'?{}:{body:JSON.stringify(body)})}));return{docs,request,user:u=>uid=u,deny:()=>unauthorized=true,writes:()=>writes};
}
test('chat rejects unauthenticated access and blocked senders',async()=>{const s=setup();s.deny();for(const method of ['GET','POST','DELETE','PATCH'])assert.equal((await s.request(method,{})).status,401);const b=setup();b.docs.get('users/member').blocked=true;assert.equal((await b.request('POST',{text:'Zpráva',clientId:'one'})).status,403);});
test('chat validates text and IDs and takes author identity only from the verified profile',async()=>{const s=setup();for(const text of ['','  ','x'.repeat(1001)])assert.equal((await s.request('POST',{text,clientId:'one'})).status,400);assert.equal((await s.request('POST',{text:'Ahoj',clientId:'../bad'})).status,400);const res=await s.request('POST',{text:' Ahoj\r\nkomunito ',clientId:'one',uid:'admin',nickname:'Podvrh'});assert.equal(res.status,200);const row=s.docs.get('communityChat/member_one');assert.equal(row.uid,'member');assert.equal(row.nickname,'Radek');assert.equal(row.text,'Ahoj\nkomunito');});
test('chat deduplicates retry requests and rate limits a different message',async()=>{const s=setup(),body={text:'Ahoj',clientId:'one'};await s.request('POST',body);const writes=s.writes();assert.equal((await s.request('POST',body)).status,200);assert.equal(s.writes(),writes);const limited=await s.request('POST',{text:'Další',clientId:'two'});assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'3');assert.equal(s.docs.has('communityChat/member_two'),false);});
test('only author or admin can retract a message; tombstones erase text but retain ordering',async()=>{const s=setup();await s.request('POST',{text:'Ahoj',clientId:'one'});s.user('other');assert.equal((await s.request('DELETE',{id:'member_one'})).status,403);assert.equal(s.docs.get('communityChat/member_one').text,'Ahoj');s.user('admin');assert.equal((await s.request('DELETE',{id:'member_one'})).status,200);assert.equal(s.docs.get('communityChat/member_one').deleted,true);assert.equal(s.docs.get('communityChat/member_one').text,'');assert.ok(s.docs.get('communityChat/member_one').createdAt);});
test('chat returns safe chronological messages and does not expose internal fields',async()=>{const s=setup();await s.request('POST',{text:'<script>text only</script>',clientId:'one'});const response=await s.request('GET');assert.equal(response.headers.get('cache-control'),'private, no-store');const data=await response.json();assert.equal(data.messages.length,1);assert.equal(data.messages[0].canDelete,true);assert.equal(data.messages[0].text,'<script>text only</script>');assert.equal(data.hasMore,false);assert.equal((await s.request('GET',null,'?before=../bad')).status,400);});
test('unchanged chat polling returns only a revision and does not resend history',async()=>{const s=setup();await s.request('POST',{text:'Ahoj',clientId:'one'});const first=await(await s.request('GET')).json();const next=await(await s.request('GET',null,'?revision='+encodeURIComponent(first.revision))).json();assert.equal(next.unchanged,true);assert.deepEqual(next.messages,[]);});

test('activity picker returns only the latest three own public activity previews',async()=>{
 const s=setup();for(let i=0;i<5;i++)s.docs.set('runs/r'+i,{uid:'member',type:i===4?'kliky':'běh',repetitions:30,km:i,timestamp:new Date(2026,0,i+1),imageUrls:[photo, photo],email:'private'});
 s.docs.set('runs/foreign',{uid:'other',timestamp:new Date(2027,0,1),imageUrl:photo});
 s.docs.set('runs/no-photos',{uid:'member',timestamp:new Date(2028,0,1)});
 const data=await(await s.request('GET',null,'?picker=activities')).json();
 assert.deepEqual(data.activities.map(a=>a.id),['r4','r3','r2']);assert.deepEqual(Object.keys(data.activities[0]).sort(),['id','thumbnails']);assert.equal(data.activities[0].thumbnails.length,1);assert.match(data.activities[0].thumbnails[0],/w_192/);
});
test('shared activity is validated on the server and can be sent without text',async()=>{
 const s=setup();s.docs.set('runs/own',{uid:'member',type:'dřepy',repetitions:45,imageUrl:photo});s.docs.set('runs/foreign',{uid:'other'});
 assert.equal((await s.request('POST',{activityId:'foreign',clientId:'bad'})).status,400);
 assert.equal((await s.request('POST',{activityId:'missing',clientId:'bad'})).status,400);
 assert.equal((await s.request('POST',{activityId:'own',clientId:'one',activity:{amount:999}})).status,200);
 let data=await(await s.request('GET')).json();assert.deepEqual(Object.keys(data.messages[0].activity).sort(),['id','thumbnails']);
 s.docs.delete('runs/own');data=await(await s.request('GET')).json();assert.equal(data.messages[0].activityUnavailable,true);
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
