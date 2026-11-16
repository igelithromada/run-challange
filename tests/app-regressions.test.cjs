const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const { parseActivityDate }=require('../app/lib/runData.ts');
const { gpxDistanceLabel, MAX_GPX_SIZE }=require('../app/lib/gpx.ts');
const formatTime=require('../app/lib/formatTime.ts').default;
const { isValidPushSubscription }=require('../app/lib/validation.ts');
function loadIsolated(file, dependencies={}, globals={}) {
  const filename=path.resolve(file), testModule={exports:{}};
  const source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(source,{module:testModule,exports:testModule.exports,require:name=>dependencies[name]||require(require.resolve(name,{paths:[path.dirname(filename)]})),console,Date,Intl,URL,TextDecoder,AbortController,Response,Request,setTimeout,clearTimeout,...globals},{filename});
  return testModule.exports;
}
test('activity dates accept both Firestore JSON and ISO, reject invalid or missing dates',()=>{
  assert.equal(parseActivityDate({seconds:1700000000,nanoseconds:123000000}).toISOString(),'2023-11-14T22:13:20.123Z');
  assert.equal(parseActivityDate('2026-11-16T10:30:00+01:00').toISOString(),'2026-11-16T09:30:00.000Z');
  for(const bad of [null,undefined,'bad',{},0])assert.equal(parseActivityDate(bad),null);
});
test('duration rounding carries seconds to the next minute',()=>{
  assert.equal(formatTime(1.999),'2:00');assert.equal(formatTime(NaN),'0:00');assert.equal(formatTime(-1),'0:00');
});
test('GPX accepts namespace prefixes and reversed coordinates; segments are not joined',()=>{
  const part='<g:trkseg><g:trkpt lon="18" lat="49"/><g:trkpt lon="18.001" lat="49"/></g:trkseg>';
  const gpx=`<g:gpx>${part}${part.replaceAll('49','50')}</g:gpx>`;
  const length=gpxDistanceLabel(gpx);
  assert.ok(Number.parseInt(length)>100 && Number.parseInt(length)<200,length);
  assert.equal(gpxDistanceLabel('<gpx><trkpt lat="1000" lon="18"/><trkpt lat="49" lon="18"/></gpx>'),null);
  assert.equal(gpxDistanceLabel('<html>not a route</html>'),null);
});
test('GPX proxy accepts a valid file over the old 2 MB limit and rejects off-site redirects',async()=>{
  let redirect=false;
  const api=loadIsolated('app/lib/fetchGpx.ts',{}, {fetch:async()=>redirect?new Response(null,{status:302,headers:{location:'https://evil.example/file'}}):new Response(' '.repeat(2_000_001)+'<gpx/>')});
  assert.ok((await api.fetchGpx('https://res.cloudinary.com/demo/raw/upload/route.gpx')).length>2_000_000);
  redirect=true;
  await assert.rejects(()=>api.fetchGpx('https://res.cloudinary.com/demo/raw/upload/route.gpx'),error=>error.status===400);
  redirect=false;
  const oversized=loadIsolated('app/lib/fetchGpx.ts',{}, {fetch:async()=>new Response('x',{headers:{'content-length':String(MAX_GPX_SIZE+1)}})});
  await assert.rejects(()=>oversized.fetchGpx('https://res.cloudinary.com/large'),error=>error.status===413);
});
test('weather distinguishes rain showers from snow and preserves absolute forecast times',async()=>{
  let requested;
  const data={current:{time:1794852900,weather_code:80,temperature_2m:10,precipitation:1,wind_speed_10m:20},hourly:{time:[1794852000,1794855600,1794859200],weather_code:[80,81,85],temperature_2m:[10,11,12],precipitation:[1,2,3],precipitation_probability:[50,60,70]}};
  const weather=loadIsolated('app/api/weather/route.ts',{}, {fetch:async url=>{requested=String(url);return Response.json(data);}});
  const response=await weather.GET(), body=await response.json();
  assert.equal(response.status,200);assert.equal(body.current.weatherCondition.type,'RAIN');
  assert.equal(body.hourly[0].weatherCondition.type,'RAIN');assert.equal(body.hourly[1].weatherCondition.type,'SNOW');
  assert.equal(body.hourly[0].interval.startTime,new Date(1794855600*1000).toISOString());
  assert.equal(new URL(requested).searchParams.get('timeformat'),'unixtime');
});
test('theme startup preserves cache timestamp so a newer remote theme wins',async()=>{
  let cache=JSON.stringify({uid:'u',theme:'light',customColor:'#36D1DC',gradientEnabled:true,savedAt:1000});
  const values={},effects=[];
  const theme=loadIsolated('app/lib/useThemeLoader.ts',{
    react:{useEffect:fn=>effects.push(fn)},
    'firebase/auth':{onAuthStateChanged:(_,fn)=>{queueMicrotask(()=>fn({uid:'u'}));return ()=>{};}},
    './firebase':{auth:{currentUser:{uid:'u'}}},
    './services/users':{getUserProfile:async()=>({theme:'dark',themeUpdatedAt:new Date(2000)})},
  },{queueMicrotask,localStorage:{getItem:()=>cache,setItem:(_,v)=>cache=v},window:{setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout},document:{documentElement:{setAttribute:(k,v)=>values[k]=v,removeAttribute:k=>delete values[k],style:{setProperty:(k,v)=>values[k]=v}}}});
  theme.default();effects.forEach(fn=>fn());await new Promise(resolve=>setImmediate(resolve));
  assert.equal(values['data-theme'],'dark');assert.equal(JSON.parse(cache).savedAt,2000);
});
test('a slow weather theme cannot overwrite a subsequent manual selection',async()=>{
  let resolveFetch;const values={};
  const theme=loadIsolated('app/lib/useThemeLoader.ts',{'./firebase':{auth:{currentUser:{uid:'u'}}},'./services/users':{},'firebase/auth':{}},
    {localStorage:{getItem:()=>null,setItem(){}},fetch:()=>new Promise(resolve=>resolveFetch=resolve),window:{setTimeout,clearTimeout},document:{documentElement:{setAttribute:(k,v)=>values[k]=v,removeAttribute:k=>delete values[k],style:{setProperty:(k,v)=>values[k]=v}}}});
  const pending=theme.applyTheme('weather','#36D1DC');
  await theme.applyTheme('custom','#FF0000');
  resolveFetch(Response.json({current:{weatherCondition:{type:'RAIN'}}}));await pending;
  assert.equal(values['--main-gradient'],'linear-gradient(180deg, #FF0000, #000000)');
});
test('non-admin users can view routes while admin pages retain their guard',async()=>{
  for(const redirect of [false,true]){
    const effects=[],paths=[];
    const guard=loadIsolated('app/lib/useAdminGuard.ts',{react:{useState:()=>['loading',()=>{}],useEffect:fn=>effects.push(fn)},'firebase/auth':{onAuthStateChanged:(_,fn)=>{queueMicrotask(()=>fn({uid:'u',getIdTokenResult:async()=>({claims:{}})}));return()=>{};}},'next/navigation':{useRouter:()=>({replace:p=>paths.push(p)})},'./firebase':{auth:{}},'./services/users':{getUserProfile:async()=>({role:'user'})}},{queueMicrotask});
    guard.default(redirect);effects.forEach(fn=>fn());await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(paths,redirect?['/']:[]);
  }
});
test('push subscriptions reject arbitrary/private HTTP destinations',()=>{
  const keys={p256dh:'public',auth:'auth'};
  assert.ok(isValidPushSubscription({endpoint:'https://fcm.googleapis.com/fcm/send/token',keys}));
  for(const endpoint of ['http://127.0.0.1/private','https://fcm.googleapis.com.evil.example/a','https://example.com/push','https://user:pass@fcm.googleapis.com/a'])assert.equal(isValidPushSubscription({endpoint,keys}),false);
});

test('GPS: stopping while paused counts each pause once',()=>{
  let now=1_000_000,hook=0,fix;const slots=[];let draft;
  class Clock extends Date {static now(){return now;}}
  const hooks={useState:value=>{const index=hook++;if(!(index in slots))slots[index]=typeof value==='function'?value():value;return [slots[index],next=>slots[index]=typeof next==='function'?next(slots[index]):next];},useRef:value=>{const index=hook++;return slots[index]||(slots[index]={current:value});},useEffect:()=>{hook++;}};
  const component=loadIsolated('app/components/ActivityRecorder.tsx',{react:hooks,'./InstallPwaPrompt':()=>null},
    {Date:Clock,navigator:{geolocation:{watchPosition:callback=>{fix=callback;return 1;},clearWatch(){}}}}).default;
  const render=()=>{hook=0;return component({type:'běh',onFinished:value=>draft=value});};
  const text=node=>typeof node==='string'?node:typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
  const button=(node,label)=>{if(!node)return null;if(Array.isArray(node)){for(const child of node){const value=button(child,label);if(value)return value;}return null;}if(node.type==='button'&&text(node).includes(label))return node;return button(node.props?.children,label);};
  button(render(),'Spustit').props.onClick();
  fix({coords:{latitude:49,longitude:18,accuracy:5},timestamp:now});
  now+=10_000;button(render(),'Pozastavit').props.onClick();
  now+=5_000;button(render(),'Ukončit').props.onClick();
  button(render(),'Použít měření').props.onClick();assert.equal(draft.seconds,10);
});
test('API authentication checks token revocation and rejects accounts during deletion',async()=>{
  let profile={},checked=false;
  const services={
    adminAuth:{verifyIdToken:async(token,revoked)=>{assert.equal(token,'fixture-token');checked=revoked;return {uid:'u'};}},
    adminDb:{collection:()=>({doc:()=>({get:async()=>({data:()=>profile})})})}
  };
  const api=loadIsolated('app/lib/apiAuth.ts',{'./firebaseAdmin':{getAdminServices:()=>services}});
  const request=new Request('https://example.test',{headers:{Authorization:'Bearer fixture-token'}});
  await api.requireUser(request);assert.equal(checked,true);
  profile={deleting:true};await assert.rejects(()=>api.requireUser(request),error=>error.code==='DELETING');
  await api.requireUser(request,{allowBlocked:true});
  await assert.rejects(()=>api.requireUser(new Request('https://example.test')),error=>error.code==='UNAUTHORIZED');
});

test('shared queries return a stable empty snapshot while authentication is loading',()=>{
  let index=0;const slots=[];
  const hooks={useMemo:fn=>{const i=index++;return slots[i]??(slots[i]=fn());},useState:initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>slots[i]=value];},useEffect:()=>{index++;}};
  const hook=loadIsolated('app/lib/useSharedFirestoreQuery.ts',{react:hooks,'firebase/auth':{},'./firebase':{auth:{currentUser:null}},'firebase/firestore':{}}).useSharedFirestoreQuery;
  const source={};index=0;const first=hook('runs',source);index=0;const second=hook('runs',source);
  assert.equal(first.data,second.data);assert.equal(first.loading,true);
});

test('notification navigation is limited to encoded internal detail IDs',()=>{
 const {notificationTarget}=require('../app/lib/notifications/target.ts');
 assert.equal(notificationTarget({teamId:'t'}),'/teams/t');
 assert.equal(notificationTarget({challengeId:'výzva?x=1'}),'/challenges/v%C3%BDzva%3Fx%3D1');
 assert.equal(notificationTarget({runId:'r'}),'/#run-r');
 assert.equal(notificationTarget({teamId:'https://evil.example'}),null);
 assert.equal(notificationTarget({}),null);
});

test('a notification can load an activity outside the current feed, including walking activities',async()=>{
 let reads=0;
 const runs=loadIsolated('app/lib/services/runs.ts',{'../firebase':{auth:{},db:{}},'firebase/firestore':{doc:(_,collection,id)=>({collection,id}),getDoc:async ref=>{reads++;return {id:ref.id,exists:()=>ref.id!=='deleted',data:()=>({type:'chůze',km:3})};}}});
 const run=await runs.fetchRunById('older-walk');assert.equal(run.id,'older-walk');assert.equal(run.type,'chůze');
 assert.equal(await runs.fetchRunById('deleted'),null);
 await assert.rejects(()=>runs.fetchRunById('bad/id'));assert.equal(reads,2);
});
