const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function load(file,deps={}){const filename=path.resolve(file),module={exports:{}},req=Module.createRequire(filename);const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:name=>{if(deps[name])return deps[name];if(name.startsWith('.'))for(const ext of ['.ts','.tsx']){const f=path.resolve(path.dirname(filename),name+ext);if(fs.existsSync(f))return load(f,deps);}return req(name);},Date,Map,Set,URL,console},{filename});return module.exports;}
const api=load('app/lib/myGallery.ts');
const image=name=>`https://res.cloudinary.com/demo/image/upload/v1/${name}.jpg`;
const runs=[{id:'new',uid:'me',km:5,type:'běh',timestamp:new Date('2026-11-17T09:00:00'),imageUrls:[image('new'),image('new'),image('other')]},{id:'legacy',uid:'me',type:'chůze',km:2,timestamp:new Date('2026-11-16T09:00:00'),imageUrl:image('legacy')},{id:'other-user',uid:'someone',timestamp:new Date(),imageUrls:[image('secret')]},{id:'deleted',uid:'me',deleting:true,imageUrls:[image('deleted')]}];
test('personal gallery excludes other users and deleted runs, supports legacy photos and removes duplicate run photos',()=>{const photos=api.myGalleryPhotos(runs,'me');assert.equal(photos.length,3);assert.equal(photos[0].runId,'new');assert.equal(photos.at(-1).runId,'legacy');assert.equal(new Set(photos.map(p=>p.key)).size,3);assert.equal(api.myGalleryPhotos(runs,'').length,0);});
test('gallery type and inclusive date filters select the correct activity photos',()=>{assert.equal(api.myGalleryPhotos(runs,'me','chůze').length,1);assert.equal(api.myGalleryPhotos(runs,'me','all','2026-11-17','2026-11-17').length,2);assert.equal(api.myGalleryPhotos(runs,'me','all','2026-11-18','2026-11-17').length,0);});
test('the gallery renders lazy reduced previews and never loads someone else’s photo',()=>{
 let state=0;const values=[false,'me',runs,{mode:'dated'},false,'',null],hooks={...React,useState:initial=>[state<values.length?values[state++]:typeof initial==='function'?initial():initial,()=>{}]};const blank={__esModule:true,default:()=>null};
 const Page=load('app/gallery/page.tsx',{react:hooks,'next/navigation':{useRouter:()=>({push(){}})},'firebase/auth':{onAuthStateChanged(){return()=>{};}},'../lib/firebase':{auth:{}},'../lib/services/galleryRuns':{fetchGalleryRunPage(){throw Error('Unexpected database read during render');}},'../components/Navbar':blank,'../components/Sidebar':blank}).default;
 const html=renderToStaticMarkup(React.createElement(Page));assert.match(html,/w_640,h_720/);assert.match(html,/loading="lazy"/);assert.doesNotMatch(html,/secret\.jpg|deleted\.jpg|my-gallery-viewer/);assert.match(html,/Fotografie mých záznamů/);assert.doesNotMatch(html,/Typ aktivit v galerii|Od data|Do data|Zrušit filtr/);
});
const find=(n,p)=>{if(!n)return;if(Array.isArray(n)){for(const c of n){const r=find(c,p);if(r)return r;}return;}if(p(n))return n;return find(n.props?.children,p);};
test('full-size shared viewer supports swiping and keyboard navigation without visible arrows or index controls',()=>{
 const moves=[];const hooks={useRef:value=>({current:value}),useEffect(){},useState:value=>[value,()=>{}]};const Viewer=load('app/components/PhotoViewer.tsx',{react:hooks}).default;
 const tree=Viewer({url:'https://example.com/photo.jpg',onClose(){},onMove:d=>moves.push(d)}),frame=find(tree,n=>n.props?.className==='shared-photo-pane'),target={setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:300,height:200})};
 frame.props.onPointerDown({pointerId:1,clientX:200,clientY:100,currentTarget:target});frame.props.onPointerUp({pointerId:1,clientX:70,clientY:105,currentTarget:target});assert.equal(moves[0],1);
 tree.props.onKeyDown({key:'ArrowLeft',preventDefault(){}});assert.equal(moves[1],-1);
 assert.equal(find(tree,n=>n.type==='button'&&n.props['aria-label']==='Další fotografie'),undefined);
 frame.props.onPointerDown({pointerId:1,clientX:200,clientY:100,currentTarget:target});frame.props.onPointerDown({pointerId:2,clientX:150,clientY:100,currentTarget:target});frame.props.onPointerUp({pointerId:1,clientX:50,clientY:100,currentTarget:target});assert.equal(moves.length,2,'pinching must not trigger a swipe');
});

test('gallery metadata is limited, uses a cursor and visits undated history only when needed', async () => {
 const own = { kind: 'own' }, dated = { kind: 'dated' };
 const rows = Array.from({ length: 24 }, (_,i) => ({
  id: 'run' + i, data: () => ({ uid: 'me', timestamp: new Date(2026,10,i+1) }),
 }));
 const last = { id: 'last', data: () => ({ uid: 'me', timestamp: new Date(2026,9,1) }) };
 const legacy = { id: 'legacy', data: () => ({ uid: 'me', imageUrl: image('legacy') }) };
 const requests = [];
 let counts = 0, countUnavailable = false;
 const service = load('app/lib/services/galleryRuns.ts', {
  'firebase/firestore': {
   documentId: () => 'id',
   orderBy: field => ({ order: field }),
   query: (source, ...constraints) => ({ source, constraints }),
   limit: size => ({ size }),
   startAfter: after => ({ after }),
   getDocs: async ({ source, constraints }) => {
    requests.push({ source, constraints });
    const docs = source === dated ? (constraints.some(item => item.after) ? [last] : rows) : [last, legacy];
    return { docs, size: docs.length };
   },
   getCountFromServer: async source => {
    counts++;
    if (countUnavailable) throw new Error("Offline");
    return { data: () => ({ count: source === own ? 26 : 25 }) };
   },
  },
  './runs': {
   personalHistoryQuery: uid => { assert.equal(uid,'me'); return own; },
   userRunsQuery: uid => { assert.equal(uid,'me'); return dated; },
   mapRunSnapshot: row => ({ id: row.id, ...row.data() }),
  },
 });
 const first = await service.fetchGalleryRunPage('me', { mode: 'dated' });
 assert.equal(first.items.length,24);
 assert.equal(requests[0].constraints.at(-1).size,24);
 assert.equal(counts,0);
 const second = await service.fetchGalleryRunPage('me', first.next);
 assert.equal(requests[1].constraints[0].after,rows[23]);
 assert.equal(second.items[0].id,'last');
 assert.equal(counts,2);
 assert.equal(second.next.mode,'undated');
 const third = await service.fetchGalleryRunPage('me', second.next);
 assert.equal(third.items.length,1);
 assert.equal(third.items[0].id,'legacy');
 assert.equal(third.next,null);
 countUnavailable = true;
 const offline = await service.fetchGalleryRunPage('me', first.next);
 assert.equal(offline.items[0].id, 'last');
 assert.equal(offline.next.mode, 'undated');

});


test('gallery remains usable while the ordering index is being built', async () => {
 const own = {}, dated = {};
 const fields = { uid: 'me', imageUrl: image('before-index') };
 const service = load('app/lib/services/galleryRuns.ts', {
  'firebase/firestore': {
   limit: size => size,
   query: source => source,
   getDocs: async source => {
    if (source === dated) throw Object.assign(new Error('Index is building'), { code: 'failed-precondition' });
    assert.equal(source, own);
    return { docs: [{ id: 'legacy', data: () => fields }] };
   },
  },
  './runs': {
   personalHistoryQuery: () => own,
   userRunsQuery: () => dated,
   mapRunSnapshot: row => ({ id: row.id, ...row.data() }),
  },
 });
 const page = await service.fetchGalleryRunPage('me', { mode: 'dated' });
 assert.equal(page.items[0].imageUrl, fields.imageUrl);
 assert.equal(page.next, null);
});
