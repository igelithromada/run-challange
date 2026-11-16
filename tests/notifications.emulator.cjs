const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getFirestore,Timestamp}=require('firebase-admin/firestore');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const app=initializeApp({projectId:'demo-notifications'},'notifications'),db=getFirestore(app);
const load=Module._load;
Module._load=function(name){
 if(name.endsWith('/apiAuth'))return {requireUser:async request=>({decoded:{uid:request.headers.get('x-test-user')||'owner'},adminDb:db}),authErrorResponse:()=>null};
 return load.apply(this,arguments);
};
const teams=require('../app/api/teams/manage/route.ts'),challenges=require('../app/api/challenges/manage/route.ts');
const inbox=require('../app/api/notifications/route.ts'),settings=require('../app/api/settings/social-notifications/route.ts');
const {reconcileChallengeState}=require('../app/lib/challenges/server.ts');
const {notifyChallengeState}=require('../app/lib/notifications/community.ts');
const skip=!process.env.FIRESTORE_EMULATOR_HOST;
async function call(handler,body,user='owner',method='POST'){
 const r=await handler[method](new Request('https://example.test/api',{method,headers:{'x-test-user':user},...(method==='GET'?{}:{body:JSON.stringify(body)})}));
 return {status:r.status,body:await r.json()};
}
async function clean(){for(const name of ['teams','teamNames','challenges','challengeNames','users','publicProfiles','notifications','runs'])await db.recursiveDelete(db.collection(name));}
async function messages(uid){return (await db.collection('notifications').where('recipientUid','==',uid).get()).docs.map(d=>({id:d.id,...d.data()}));}
after(async()=>{if(!skip)await clean();await db.terminate();await deleteApp(app);});
test('team membership notifications are atomic, self-suppressed, preference-aware and idempotent', {skip},async()=>{
 await clean();await db.doc('users/owner').set({nickname:'Správce'});await db.doc('users/member').set({nickname:'Člen'});await db.doc('publicProfiles/member').set({nickname:'Člen'});
 const created=await call(teams,{action:'create',name:'Společný tým'});assert.equal(created.status,200);const id=created.body.team.id;
 assert.equal((await messages('owner')).length,0);
 const join=()=>call(teams,{action:'join',teamId:id},'member');
 assert.deepEqual((await Promise.all([join(),join()])).map(r=>r.status),[200,200]);
 let list=await messages('owner');assert.equal(list.length,1);assert.equal(list[0].teamId,id);assert.match(list[0].body,/Člen/);
 assert.equal((await db.doc('teams/'+id).get()).data().memberCount,2);
 assert.equal((await call(inbox,{notificationId:list[0].id},'member')).status,404);
 assert.equal((await call(inbox,{notificationId:'invalid/path'})).status,400);
 assert.equal((await call(inbox,{notificationId:list[0].id})).status,200);
 await join();assert.equal((await messages('owner')).length,0);
 assert.equal((await call(teams,{action:'leave',teamId:id},'member')).status,200);
 assert.equal((await messages('owner')).length,1);
 assert.equal((await call(settings,{socialNotifications:{likes:true,comments:false,teams:false,challenges:false}})).status,200);
 await join();assert.equal((await messages('owner')).length,1);
 assert.equal((await call(teams,{action:'transfer',teamId:id,newManagerId:'member'})).status,200);
 assert.equal((await messages('member')).length,1);
 assert.equal((await messages('member'))[0].title,'Převzal jsi správu týmu');
 assert.equal((await call(settings,{socialNotifications:{teams:'false'}})).status,400);
 await Promise.all([call(settings,{socialNotifications:{likes:false}}),call(settings,{socialNotifications:{comments:true}})]);
 const prefs=(await db.doc('users/owner').get()).data().socialNotifications;
 assert.deepEqual(prefs,{likes:false,comments:true,teams:false,challenges:false});
});
test('challenge joins notify the organiser once and respect independent preferences', {skip},async()=>{
 await clean();await db.doc('users/owner').set({});await db.doc('users/member').set({});
 await db.doc('challenges/c').set({name:'Výzva',createdBy:'owner',state:'planned',startDate:'2099-01-01',endDate:'2099-01-31',participantCount:1});
 await Promise.all([call(challenges,{action:'join',challengeId:'c'},'member'),call(challenges,{action:'join',challengeId:'c'},'member')]);
 assert.equal((await messages('owner')).length,1);assert.equal((await messages('owner'))[0].challengeId,'c');
 await call(settings,{socialNotifications:{challenges:false}});
 assert.equal((await call(challenges,{action:'leave',challengeId:'c'},'member')).status,200);
 assert.equal((await messages('owner')).length,1);
});
test('challenge start and final results are delivered once, receipts survive reading, retries and disabled settings', {skip},async()=>{
 await clean();for(const uid of ['owner','member','quiet'])await db.doc('users/'+uid).set({socialNotifications:{challenges:uid!=='quiet'}});
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 await db.doc('challenges/lifecycle').set({name:'Společná výzva',createdBy:'owner',state:'planned',startDate:today,endDate:'2099-01-31',kind:'distance',activityType:'běh',goal:10});
 for(const uid of ['owner','member','quiet'])await db.doc('challenges/lifecycle/participants/'+uid).set({active:true,userId:uid,joinedAt:Timestamp.now()});
 await Promise.all([reconcileChallengeState(db,'lifecycle'),reconcileChallengeState(db,'lifecycle')]);
 assert.equal((await messages('owner')).length,1);assert.equal((await messages('member')).length,1);assert.equal((await messages('quiet')).length,0);
 await call(inbox,{markAll:true},'member');await notifyChallengeState(db,'lifecycle');assert.equal((await messages('member')).length,0);
 // Simulate a crash after the domain transition; cron retry must finish delivery.
 await db.doc('challenges/lifecycle').update({endDate:'2000-01-01',notificationPending:true});
 await reconcileChallengeState(db,'lifecycle');
 assert.equal((await db.doc('challenges/lifecycle').get()).data().state,'completed');
 assert.equal((await messages('member')).length,1);assert.equal((await messages('member'))[0].title,'Výzva je vyhodnocená');
 await db.doc('challenges/lifecycle').update({notificationPending:true});await notifyChallengeState(db,'lifecycle');
 assert.equal((await messages('owner')).length,2);assert.equal((await messages('member')).length,1);
 assert.equal((await db.doc('challenges/lifecycle').get()).data().notificationPending,false);
 await db.doc('challenges/historic').set({name:'Starší výzva',state:'active',startDate:today,endDate:'2099-01-01'});
 await db.doc('challenges/historic/participants/member').set({active:true});await notifyChallengeState(db,'historic');
 assert.equal((await messages('member')).length,1);
});
test('inbox prioritises unseen messages and only marks the caller’s messages', {skip},async()=>{
 await clean();const batch=db.batch();for(let i=0;i<55;i++)batch.set(db.doc('notifications/read'+i),{recipientUid:'owner',read:true,createdAt:Timestamp.now()});
 batch.set(db.doc('notifications/old-unread'),{recipientUid:'owner',read:false,teamId:'team',createdAt:Timestamp.fromMillis(1)});
 batch.set(db.doc('notifications/foreign'),{recipientUid:'member',read:false});await batch.commit();
 const got=await call(inbox,{},'owner','GET');assert.equal(got.body.notifications[0].id,'old-unread');assert.equal(got.body.notifications[0].teamId,'team');assert.equal(got.body.unreadCount,1);
 await call(inbox,{markAll:true});assert.equal((await messages('member')).length,1);
});
