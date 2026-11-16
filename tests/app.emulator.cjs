const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getFirestore,Timestamp}=require('firebase-admin/firestore');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const app=initializeApp({projectId:'demo-audit-regressions'},'audit'),db=getFirestore(app);
const originalLoad=Module._load;
let deliveredPush=0;
let failNotification=false;
Module._load=function(request){
  if(request==='web-push')return {setVapidDetails(){},sendNotification:async()=>{deliveredPush++;},WebPushError:class extends Error{}};
  if(request.endsWith('/firebaseAdmin'))return {getAdminServices:()=>({adminDb:db})};
  if(request.endsWith('/apiAuth'))return {
    requireUser:async request=>{if(request.headers.get('x-test-user')==='anonymous')throw new Error('UNAUTHORIZED');return {decoded:{uid:request.headers.get('x-test-user')||'u',admin:request.headers.get('x-test-admin')==='true'},adminDb:db};},
    requireAdmin:async request=>{if(request.headers.get('x-test-admin')!=='true')throw new Error('FORBIDDEN');return {decoded:{uid:'admin',admin:true},adminDb:db};},
    authErrorResponse:error=>['UNAUTHORIZED','FORBIDDEN'].includes(error.message)?{status:error.message==='FORBIDDEN'?403:401,message:error.message}:null,
  };
  if(request.endsWith('/cloudinaryAdmin'))return {...originalLoad.apply(this,arguments),deleteCloudinaryImages:async()=>({deleted:0,failed:[]})};
  return originalLoad.apply(this,arguments);
};
const create=require('../app/api/runs/create/route.ts'),update=require('../app/api/runs/update/route.ts'),remove=require('../app/api/runs/delete/route.ts');
const photo=require('../app/api/runs/photo/route.ts'),profile=require('../app/api/settings/profile/route.ts');
const appearance=require('../app/api/settings/appearance/route.ts'),trainer=require('../app/api/trainer/plan/route.ts'),prefs=require('../app/api/settings/trainer-notifications/route.ts');
const social=require('../app/api/runs/social/route.ts'),notifications=require('../app/api/notifications/route.ts');
const {syncRunTeamContributions}=require('../app/lib/teams/contributions.ts');
const {deleteUserData}=require('../app/lib/deleteUserData.ts');
const call=async(handler,body={},method='POST',user='u')=>{
 const response=await handler[method](new Request('https://example.test/api',{method,headers:{'x-test-user':user},...(method==='GET'?{}:{body:JSON.stringify(body)})}));
 return {status:response.status,body:await response.json()};
};
const skip=!process.env.FIRESTORE_EMULATOR_HOST;
const image='https://res.cloudinary.com/demo/image/upload/v1/dolni-lhota/users/u/p.jpg';
async function clean(){for(const name of ['runs','teams','users','publicProfiles','challenges','notifications','rateLimits'])await db.recursiveDelete(db.collection(name));}
after(async()=>{if(!skip)await clean();await db.terminate();await deleteApp(app);});
test('activities: deduplicated create, timestamp edit, same-type totals, type change, concurrency and deletion', {skip},async()=>{
 await clean();
 await db.doc('teams/t').set({name:'Tým',stats:{runningKm:0,runningActivities:0,walkingKm:0,walkingActivities:0}});
 await db.doc('teams/t/members/u').set({userId:'u',active:true});
 const run={uid:'u',km:5,minuty:30,type:'běh',timestamp:'2026-11-16T10:00:00Z'};
 const first=await call(create,{run,submissionId:'draft-0000001'});assert.equal(first.status,200,JSON.stringify(first.body));const id=first.body.id;
 assert.equal((await call(create,{run,submissionId:'draft-0000001'})).body.id,id);
 assert.equal((await db.collection('runs').get()).size,1);
 const stats=async()=>(await db.doc('teams/t').get()).data().stats;
 assert.equal((await stats()).runningKm,5);assert.equal((await stats()).runningActivities,1);
 const edit={km:7,minuty:35,timestamp:{seconds:1794823200,nanoseconds:0},imageUrls:[image]};
 assert.equal((await call(update,{id,updates:edit},'PATCH')).status,200);
 assert.equal((await stats()).runningKm,7);assert.equal((await stats()).runningActivities,1);
 assert.deepEqual((await db.doc('runs/'+id).get()).data().imageUrls,[image]);
 assert.equal((await call(update,{id,updates:{...edit,type:'chůze',km:8}},'PATCH')).status,200);
 assert.deepEqual(await stats(),{runningKm:0,runningActivities:0,walkingKm:8,walkingActivities:1});
 await Promise.all([11,13].map(km=>call(update,{id,updates:{...edit,type:'chůze',km}},'PATCH')));
 assert.equal((await stats()).walkingKm,(await db.doc('runs/'+id).get()).data().km);
 // A failed previous synchronization can be safely repeated.
 await db.doc('runs/'+id).update({km:9});await syncRunTeamContributions(db,id);await syncRunTeamContributions(db,id);
 assert.equal((await stats()).walkingKm,9);assert.equal((await stats()).walkingActivities,1);
 assert.equal((await call(update,{id,updates:edit},'PATCH','other')).status,403);
 assert.equal((await call(remove,{runId:id},'DELETE','other')).status,403);
 assert.equal((await call(remove,{runId:id},'DELETE')).status,200);
 assert.deepEqual(await stats(),{runningKm:0,runningActivities:0,walkingKm:0,walkingActivities:0});
 assert.equal((await call(remove,{runId:id},'DELETE')).status,404);
 assert.equal((await call(create,{run:{...run,timestamp:'invalid'}})).status,400);
});
test('activity media: six-image bound, ownership validation and URL-bound photo deletion', {skip},async()=>{
 await db.doc('runs/media').set({uid:'u',km:2,minuty:10,type:'běh',imageUrls:[image,image.replace('p.jpg','q.jpg')]});
 const updates={km:2,minuty:10,timestamp:'2026-11-16T10:00:00Z'};
 assert.equal((await call(update,{id:'media',updates:{...updates,imageUrls:Array(7).fill(image)}},'PATCH')).status,400);
 assert.equal((await call(update,{id:'media',updates:{...updates,imageUrls:[image.replace('/users/u/','/users/other/')]}},'PATCH')).status,400);
 assert.equal((await call(photo,{runId:'media',index:0},'DELETE')).status,200);
 assert.deepEqual((await db.doc('runs/media').get()).data().imageUrls,[image.replace('p.jpg','q.jpg')]);
});
test('settings: light theme survives reload; concurrent profile changes keep public and private data consistent', {skip},async()=>{
 assert.equal((await call(appearance,{theme:'light',customColor:'#112233',gradientEnabled:false})).status,200);
 assert.equal((await db.doc('users/u').get()).data().theme,'light');
 const saved=await Promise.all([call(profile,{nickname:'Radek Test'}),call(profile,{avatarUrl:image})]);
 assert.ok(saved.every(r=>r.status===200));
 for(const collection of ['users','publicProfiles']){
  const data=(await db.doc(collection+'/u').get()).data();assert.equal(data.nickname,'Radek Test');assert.equal(data.avatarUrl,image);
 }
 assert.equal((await call(prefs,{trainerNotifications:{enabled:true,todayTime:'14:00',tomorrowTime:'19:00'}})).body.trainerNotifications.todayTime,'14:00');
 assert.equal((await call(prefs,{trainerNotifications:{enabled:true,todayTime:'14:30'}})).status,400);
 assert.equal((await call(prefs,{trainerNotifications:{enabled:true,todayTime:'25:00'}})).status,400);
});
test('trainer: calendar validation and concurrent months do not overwrite one another', {skip},async()=>{
 const plan=(month,date)=>({monthKey:month,type:'běh',dates:[date],dayKm:{[date]:5}});
 assert.equal((await call(trainer,{plan:plan('2026-02','2026-02-30')})).status,400);
 assert.equal((await call(trainer,{plan:plan('2026-13','2026-13-01')})).status,400);
 await Promise.all([call(trainer,{plan:plan('2026-11','2026-11-17')}),call(trainer,{plan:plan('2026-12','2026-12-01')})]);
 const plans=(await db.doc('users/u').get()).data().personalTrainerPlans.běh;
 assert.equal(plans['2026-11'].monthlyKm,5);assert.equal(plans['2026-12'].monthlyKm,5);
});
test('notifications: newest fifty are returned and marking all clears more than 500 safely', {skip},async()=>{
 for(let start=0;start<520;start+=250){const batch=db.batch();for(let i=start;i<Math.min(520,start+250);i++)batch.set(db.doc('notifications/n'+i),{recipientUid:'u',read:false,createdAt:Timestamp.fromMillis(1000000+i*1000)});await batch.commit();}
 await db.doc('notifications/other').set({recipientUid:'other',read:false});
 const response=await call(notifications,{},'GET');assert.equal(response.status,200);
 assert.equal(response.body.unreadCount,520);assert.equal(response.body.notifications.length,50);assert.equal(response.body.notifications[0].id,'n519');
 assert.equal((await call(notifications,{markAll:true})).status,200);
 assert.equal((await db.collection('notifications').where('recipientUid','==','u').get()).size,0);
 assert.equal((await db.doc('notifications/other').get()).exists,true);
});
test('social: concurrent duplicate deletion decrements the counter only once', {skip},async()=>{
 await db.doc('runs/social').set({uid:'owner',commentCount:2,likedBy:[],likeCount:0});
 await db.doc('runs/social/comments/c1').set({uid:'u',text:'Test'});await db.doc('runs/social/comments/c2').set({uid:'owner',text:'Druhý'});
 await Promise.all([call(social,{action:'comment_delete',runId:'social',commentId:'c1'}),call(social,{action:'comment_delete',runId:'social',commentId:'c1'})]);
 assert.equal((await db.doc('runs/social').get()).data().commentCount,1);
 const collection=db.collection.bind(db);
 db.collection=function(path){const value=collection(path);if(path==='notifications')value.add=async()=>{throw new Error('Injected notification failure');};return value;};
 try{
  assert.equal((await call(social,{action:'like',runId:'social'})).status,200);
  assert.equal((await db.doc('runs/social').get()).data().likeCount,1);
  assert.equal((await call(social,{action:'comment',runId:'social',text:'Ahoj'})).status,200);
  assert.equal((await db.doc('runs/social').get()).data().commentCount,2);
 }finally{db.collection=collection;}
});
test('account cleanup removes nested subscriptions without collection-group indexes', {skip},async()=>{
 await db.doc('users/departing').set({nickname:'Test'});
 await db.doc('users/departing/pushSubscriptions/s').set({endpoint:'https://fcm.googleapis.com/test'});
 await db.doc('teams/cleanup').set({name:'Tým',managerId:'departing',memberCount:2});
 await db.doc('teams/cleanup/members/departing').set({userId:'departing',active:true});
 await db.doc('teams/cleanup/members/replacement').set({userId:'replacement',active:true});
 await deleteUserData(db,'departing');
 assert.equal((await db.doc('users/departing').get()).exists,false);
 assert.equal((await db.doc('users/departing/pushSubscriptions/s').get()).exists,false);
 assert.equal((await db.doc('teams/cleanup').get()).data().managerId,'replacement');
});

test('trainer delivery keeps independent sent markers for today and tomorrow', {skip},async()=>{
 const previous={};for(const key of ['CRON_SECRET','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT']){previous[key]=process.env[key];process.env[key]='fixture-'+key;}
 try {
  await clean();
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const next=new Date(today+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);const tomorrow=next.toISOString().slice(0,10);
  const hour=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Prague',hour:'2-digit',hourCycle:'h23'}).format(new Date())+':00';
  const plans={};for(const date of [today,tomorrow]){const month=date.slice(0,7);plans[month]??={type:'běh',monthKey:month,dates:[],dayKm:{}};plans[month].dates.push(date);plans[month].dayKm[date]=5;}
  await db.doc('users/scheduled').set({trainerNotifications:{enabled:true,today:true,tomorrow:true,todayTime:hour,tomorrowTime:hour},personalTrainerPlans:{běh:plans}});
  await db.doc('users/scheduled/pushSubscriptions/test').set({endpoint:'https://fcm.googleapis.com/fixture',keys:{auth:'fixture',p256dh:'fixture'}});
  const scheduler=require('../app/api/notifications/trainer/route.ts');
  const request=()=>new Request('https://example.test',{headers:{Authorization:'Bearer '+process.env.CRON_SECRET}});
  deliveredPush=0;assert.equal((await scheduler.GET(request())).status,200);assert.equal(deliveredPush,2);
  assert.equal((await scheduler.GET(request())).status,200);assert.equal(deliveredPush,2);
  const prefs=(await db.doc('users/scheduled').get()).data().trainerNotifications;
  assert.equal(prefs.enabled,true);assert.ok(prefs.lastSentKeys.today);assert.ok(prefs.lastSentKeys.tomorrow);
 }finally{for(const [key,value]of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
test('registration rate limits are shared by concurrent requests', {skip},async()=>{
 const {consumeRateLimit}=require('../lib/rateLimit.ts');
 const request=new Request('https://example.test',{headers:{'x-forwarded-for':'192.0.2.10'}});
 const results=await Promise.all(Array.from({length:3},()=>consumeRateLimit(db,request,'fixture',2)));
 assert.equal(results.filter(value=>value.allowed).length,2);assert.equal(results.filter(value=>!value.allowed).length,1);
});
