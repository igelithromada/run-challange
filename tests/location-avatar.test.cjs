const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), Module = require('node:module'), ts = require('typescript');
function load(file, dependencies = {}, globals = {}) {
  const filename = path.resolve(file), module = { exports: {} }, req = Module.createRequire(filename);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => { if(dependencies[name])return dependencies[name]; if(name.startsWith(".")){for(const ext of [".ts",".tsx"]){const f=path.resolve(path.dirname(filename),name+ext);if(fs.existsSync(f))return load(f,dependencies,globals);}}return req(name); }, URL, URLSearchParams, AbortController, Date, Response, setTimeout, clearTimeout, console, process, ...globals }, { filename });
  return module.exports;
}
test('avatar crop stays inside portrait and landscape photos at every position and zoom', () => {
  const { avatarCrop } = load('app/lib/avatarCrop.ts');
  for (const [w, h] of [[4000,3000], [3000,4000], [512,512]]) for (const zoom of [1, 1.5, 3]) for (const x of [-100,0,100]) for (const y of [-100,0,100]) {
    const c = avatarCrop(w,h,zoom,x,y); assert.ok(c.sx >= 0 && c.sy >= 0);
    assert.ok(c.sx + c.size <= w + .00001); assert.ok(c.sy + c.size <= h + .00001);
    assert.ok(c.displayWidth >= 260 && c.displayHeight >= 260);
  }
  const c = avatarCrop(4000,3000,1,100,0); assert.equal(c.sx,0); assert.equal(c.size,3000);
});
test('location messages distinguish denied access, unavailable location, and timeout', () => {
  const api = load('app/lib/location.ts');
  assert.match(api.locationErrorMessage(1), /zakázaný/); assert.match(api.locationErrorMessage(2), /Zapni polohu/); assert.match(api.locationErrorMessage(3), /příliš dlouho/);
  assert.match(api.coordinatesLabel(-49,-18), /j. š.*z. d./);
});
test('place names are cached and a shared lease limits geocoding across users', async () => {
  const docs = new Map(); let calls=0;
  const snapshot = key => ({ exists: docs.has(key), data: () => docs.get(key) });
  const db = { collection: name => ({ doc: id => ({ key: `${name}/${id}`, get: async () => snapshot(`${name}/${id}`), set: async value => docs.set(`${name}/${id}`, value) }) }), runTransaction: async fn => fn({ get: async ref => snapshot(ref.key), set: (ref,data) => docs.set(ref.key,data) }) };
  const api = load('app/api/weather/location/route.ts', { '../../../lib/apiAuth': { requireUser: async () => ({ adminDb: db }), authErrorResponse: () => null } }, { fetch: async url => { calls++; assert.equal(new URL(url).searchParams.get('zoom'),'16'); return Response.json({ address: { village: 'Dolní Lhota', state: 'Moravskoslezský kraj' } }); } });
  const get = (lat,lon) => api.GET(new Request(`https://example.test/api/weather/location?lat=${lat}&lon=${lon}`));
  assert.equal((await (await get(49.84,18.10)).json()).name, 'Dolní Lhota');
  await get(49.84,18.10); assert.equal(calls,1);
  assert.equal((await (await get(49.9,18.2)).json()).name,null); assert.equal(calls,1);
  assert.equal((await get(91,18)).status,400);
});
const text = node => typeof node === 'string' ? node : typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
function find(node, predicate) { if (!node) return; if (Array.isArray(node)) { for (const child of node) { const result=find(child,predicate); if(result)return result; } return; } if(predicate(node))return node; return find(node.props?.children,predicate); }
test('weather reports GPS failure, automatically recovers, names the place, and clears status for fixed location', async () => {
  let hook=0, enabled=false, timerId=0; let coords={latitude:49.84123,longitude:18.10456,accuracy:60}; const requests=[]; const slots=[], effects=[], timers=new Map();
  const same = (a,b) => a && b && a.length===b.length && a.every((v,i)=>v===b[i]);
  const hooks={ useState: initial => { const i=hook++; if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial; return [slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value]; }, useRef: initial=>{const i=hook++;return slots[i]||(slots[i]={current:initial});}, useCallback: (fn,deps)=>{const i=hook++;if(!same(slots[i]?.deps,deps))slots[i]={deps,fn};return slots[i].fn;}, useEffect: (fn,deps)=>{const i=hook++;if(!same(slots[i]?.deps,deps)){const old=slots[i]; effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}} };
  const helpers=load('app/lib/weather.ts'), location=load('app/lib/location.ts');
  const weather={current:{temperature:{degrees:7}},hourly:[],fetchedAt:new Date().toISOString()};
  const Card=load('app/components/WeatherCard.tsx',{react:hooks,'../lib/weather':helpers,'../lib/location':location,'./WeatherVisual':{default:()=>null,weatherDescription:()=>''},'../lib/firebase':{auth:{currentUser:{getIdToken:async()=>'token'}}}}, {
    navigator:{permissions:{query:async()=>({state:'granted'})},geolocation:{getCurrentPosition:(yes,no,options)=>{ assert.equal(options.enableHighAccuracy,true); return enabled?yes({coords}):no({code:2}); }}},
    document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}},window:{setTimeout:()=>1,clearTimeout(){},setInterval:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearInterval:id=>timers.delete(id),addEventListener(){},removeEventListener(){}},
    fetch:async url=>{requests.push(url);return Response.json(url.includes('/location?')?{name:'Dolní Lhota'}:weather);},
  }).default;
  const render=()=>{hook=0;const result=Card();effects.splice(0).forEach(fn=>fn());return result;};
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  render(); await flush();
  find(render(), n=>n.type==='button'&&text(n)==='Moje poloha (GPS)').props.onClick(); await flush();
  assert.match(text(render()),/Zapni polohu/);
  enabled=true; [...timers.values()].find(t=>t.ms===15000).fn(); await flush();
  assert.match(text(render()),/Poloha dostupná/); assert.match(text(render()),/Dolní Lhota/);
  assert.ok(requests.some(url=>url.startsWith('/api/weather?')&&url.includes('lat=49.84123')&&url.includes('lon=18.10456')));
  assert.ok(requests.some(url=>url.includes('/location?v=2&lat=49.84123&lon=18.10456')));
  const stationaryRequests=requests.length;
  coords={...coords,latitude:49.84124}; [...timers.values()].find(t=>t.ms===15000).fn(); await flush();
  assert.equal(requests.length,stationaryRequests,'GPS jitter does not refetch or geocode');
  coords={...coords,latitude:49.84456}; [...timers.values()].find(t=>t.ms===15000).fn(); await flush();
  assert.ok(requests.some(url=>url.startsWith('/api/weather?')&&url.includes('lat=49.84456')));
  assert.ok(requests.some(url=>url.includes('/location?v=2&lat=49.84456')));
  enabled=false; [...timers.values()].find(t=>t.ms===15000).fn(); await flush();
  assert.match(text(render()),/poslední zjištěnou polohu/);
  find(render(), n=>n.type==='button'&&text(n)==='Dolní Lhota').props.onClick(); await flush();
  assert.doesNotMatch(text(render()),/Zapni polohu|poslední zjištěnou polohu/);
});

test('activity keeps its gallery without a photo action, and comment actions stay in the heading', () => {
  const React=require('react'), { renderToStaticMarkup }=require('react-dom/server');
  let state=0;
  const initial=[false,0,1,'comments',[{id:'c',uid:'me',nickname:'Radek',text:'Text komentáře',mine:true}],[],false,false,'',false,false,'',false,'Radek','',null,''];
  const hooks={...React,useState:value=>[state<initial.length?initial[state++]:value,()=>{}],useEffect(){}};
  const Card=load('app/components/ActivityCard.tsx',{react:hooks,'./ActivityGallery':{__esModule:true,default:()=>React.createElement('div',{'aria-label':'Galerie aktivity'})},'../lib/firebase':{auth:{currentUser:null}},'../lib/imageUrl':{cloudinaryImageUrl:v=>v},'../lib/services/publicProfiles':{getPublicProfiles:async()=>({})},'./AppToast':{showAppToast(){}}}).default;
  const html=renderToStaticMarkup(React.createElement(Card,{run:{id:'r',km:1,minuty:10,tempo:10,imageUrls:['photo.jpg']},activityType:'běh',onPhotosClick(){}}));
  assert.match(html,/Galerie aktivity/);assert.doesNotMatch(html,/aria-label="Fotografie ·/);
  const heading=html.slice(html.indexOf('social-comment-heading'),html.indexOf('<p>Text komentáře'));
  assert.match(heading,/aria-label="Upravit komentář"/);assert.match(heading,/aria-label="Smazat komentář"/);
});

test('weather place names prefer districts and local areas while retaining the municipality',()=>{
  const {weatherLocationName:name}=load('app/lib/weatherLocation.ts');
  assert.equal(name({city:'Ostrava',suburb:'Poruba',state:'Moravskoslezský kraj'}),'Ostrava · Poruba');
  assert.equal(name({city:'Ostrava',city_district:'Ostrava-Jih',suburb:'Hrabůvka'}),'Ostrava · Hrabůvka');
  assert.equal(name({city:'Ostrava',neighbourhood:'Dubina'}),'Ostrava · Dubina');
  assert.equal(name({village:'Dolní Lhota',state:'Moravskoslezský kraj'}),'Dolní Lhota');
  assert.equal(name({city:'Ostrava',suburb:'Ostrava-Poruba'}),'Ostrava-Poruba');
  assert.equal(name({city:'Ostrava-Poruba',suburb:'Poruba'}),'Ostrava-Poruba');
  assert.equal(name({city:'Ostrava',suburb:'ostrava'}),'ostrava');
  assert.equal(name({hamlet:'Nové Dvory'}),'Nové Dvory');
  assert.equal(name({state:'Moravskoslezský kraj'}),null);
  assert.equal(name({city:123,suburb:{}}),null);
});

test('weather retains metre-scale coordinate precision and detects moves without reacting to jitter',()=>{
  const {weatherCoordinates:coords,weatherLocationMoved:moved}=load('app/lib/weatherLocation.ts');
  const a=coords(49.841234567,18.10456789),b=coords(49.84456,18.10456);
  assert.equal(a.lat,49.84123);assert.equal(a.lon,18.10457);
  assert.notEqual(a.lat,b.lat);assert.equal(moved(null,a),true);assert.equal(moved(a,a),false);
  assert.equal(moved(a,{...a,lat:a.lat+.00001}),false);assert.equal(moved(a,b),true);
  assert.equal(moved({lat:0,lon:0},{lat:0,lon:.002}),true);
});

test('reverse geocoding receives precise coordinates and ignores old kilometre-scale cached names',async()=>{
  const docs=new Map([['weatherLocations/49.84_18.10',{name:'Ostrava',expiresAt:Date.now()+86400000}]]);let calls=0;
  const snapshot=key=>({exists:docs.has(key),data:()=>docs.get(key)});
  const db={collection:name=>({doc:id=>({key:`${name}/${id}`,get:async()=>snapshot(`${name}/${id}`),set:async v=>docs.set(`${name}/${id}`,v)})}),runTransaction:async fn=>fn({get:async ref=>snapshot(ref.key),set:(ref,v)=>docs.set(ref.key,v)})};
  const api=load('app/api/weather/location/route.ts',{'../../../lib/apiAuth':{requireUser:async()=>({adminDb:db}),authErrorResponse:()=>null}},{fetch:async input=>{calls++;const url=new URL(input);assert.equal(url.searchParams.get('lat'),'49.84123');assert.equal(url.searchParams.get('lon'),'18.10457');assert.equal(url.searchParams.get('zoom'),'16');return Response.json({address:{city:'Ostrava',suburb:'Poruba'}});}});
  const get=()=>api.GET(new Request('https://example.test/api/weather/location?v=2&lat=49.84123456&lon=18.10456789'));
  assert.equal((await(await get()).json()).name,'Ostrava · Poruba');assert.ok(docs.has('weatherLocations/v2_49.84123_18.10457'));
  await get();assert.equal(calls,1);
});
