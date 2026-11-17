const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function load(file,deps={}){const filename=path.resolve(file),module={exports:{}},req=Module.createRequire(filename);const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:name=>{if(deps[name])return deps[name];if(name.startsWith('.'))for(const ext of ['.ts','.tsx']){const f=path.resolve(path.dirname(filename),name+ext);if(fs.existsSync(f))return load(f,deps);}return req(name);},Date,Map,Set,console},{filename});return module.exports;}
const api=load('app/lib/results.ts');
const run=(uid,km,minuty,date='2026-11-16T10:00:00',type='běh')=>({id:uid+km,uid,km,minuty,type,timestamp:new Date(date)});
const runs=[run('a',1,10),run('a',3,15),run('b',2,20),run('c',8,80,'2026-11-15T12:00:00','chůze'),run('d',10,50,'2026-10-01T12:00:00')];
const profiles={a:{id:'a',nickname:'Radek Pešák'},b:{id:'b',nickname:'Čeněk Novák'}};
test('merged results preserve activity, participant, kilometre, duration and weighted pace calculations with all date/type filters',()=>{
 const filtered=api.resultRuns(runs,'běh','2026-11-16','2026-11-16'),people=api.resultPeople(filtered,profiles,'km');
 assert.equal(filtered.length,3);assert.equal(people.length,2);assert.equal(people[0].km,4);assert.equal(people[0].minutes,25);assert.equal(people[0].count,2);assert.equal(people[0].pace,6.25);
 const metrics=load('app/lib/activityMetrics.ts').activityMetrics(filtered);assert.equal(metrics.km,6);assert.equal(metrics.minutes,45);assert.equal(metrics.pace,7.5);assert.equal(metrics.count,3);
 assert.equal(api.resultRuns(runs,'chůze','','').length,1);assert.equal(api.resultRuns(runs,'běh','2026-11-17','2026-11-16').length,0);
 assert.equal(api.resultRuns(runs,'běh','2026-11-16','').filter(r=>r.uid==='a').length,2);
});
test('search is accent-insensitive, supports partial names and keeps original ranking',()=>{
 const people=api.resultPeople(api.resultRuns(runs,'běh','2026-11-16','2026-11-16'),profiles,'km');
 const found=api.visiblePeople(people,'cEN nOV',false);assert.equal(found.length,1);assert.equal(found[0].uid,'b');assert.equal(found[0].rank,2);
 assert.equal(api.visiblePeople(people,'pes RAD',false)[0].uid,'a');
});
test('Czech alphabetical grouping handles CH, accented consonants and nonletters',()=>{
 for(const [name,letter] of [['Čeněk','Č'],['Řehoř','Ř'],['Šárka','Š'],['Žaneta','Ž'],['Ďábel','D'],['Ája','A'],['Chalupa','CH'],['123','#']])assert.equal(api.resultLetter(name),letter);
 const people=['Iva','Chalupa','Hana','Čeněk','Cyril'].map((name,i)=>({name,uid:String(i)}));
 assert.deepEqual(Array.from(api.visiblePeople(people,'',true),p=>p.name),['Cyril','Čeněk','Hana','Chalupa','Iva']);
});
test('pace ranking puts unknown pace last and duration rounding carries into hours',()=>{
 const people=api.resultPeople([run('missing',1,0),run('known',1,5)],{},'tempo');assert.equal(people[0].uid,'known');assert.equal(people[1].uid,'missing');
 assert.equal(api.formatResultDuration(59.999),'1 h 0 min');
});
function renderResults(overrides={}){let i=0;const initial=[false,'a','běh','jednotlivci','km','rank','2026-11-16','2026-11-16','',profiles,''];for(const [key,value]of Object.entries(overrides))initial[Number(key)]=value;const hooks={...React,useState:()=>[initial[i++],()=>{}]};const blank={__esModule:true,default:()=>null};const Page=load('app/statistics/page.tsx',{react:hooks,'next/navigation':{useRouter:()=>({push(){}})},'firebase/auth':{onAuthStateChanged(){return()=>{};}},'../lib/firebase':{auth:{}},'../lib/useSharedFirestoreQuery':{useSharedFirestoreQuery:()=>({data:runs,loading:false,error:null})},'../lib/services/runs':{filteredRunsQuery:()=>({})},'../lib/services/publicProfiles':{getPublicProfiles:async()=>profiles},'../components/Navbar':blank,'../components/Sidebar':blank,'../components/LoadingSkeleton':blank}).default;return renderToStaticMarkup(React.createElement(Page));}
test('merged screen retains every existing filter and all five summary values',()=>{
 const html=renderResults();for(const text of ['Já','Jednotlivci','Km','Tempo','Od data','Do data','Celkem km','Čas','Průměrné tempo','Aktivity','Účastníci','Hledat uživatele podle přezdívky','Podle abecedy'])assert.ok(html.includes(text),text);
 assert.match(html,/6\.00 km/);assert.match(html,/Stupně vítězů/);
 const mine=renderResults({3:'já'});assert.match(mine,/4\.00 km/);assert.doesNotMatch(mine,/Stupně vítězů/);
});
test('search and alphabetical mode hide the podium without relabelling a found user as the winner',()=>{
 const searched=renderResults({8:'cenek'});assert.doesNotMatch(searched,/Stupně vítězů/);assert.match(searched,/Čeněk Novák/);assert.doesNotMatch(searched,/Radek Pešák/);
 const alpha=renderResults({5:'alpha'});assert.match(alpha,/Abecední navigace/);assert.match(alpha,/data-letter="Č"/);assert.doesNotMatch(alpha,/Stupně vítězů/);
});
test('legacy participants slot opens the personal gallery and results remain unified',()=>{
 let target;load('app/participants/page.tsx',{'next/navigation':{redirect:path=>target=path}}).default();assert.equal(target,'/gallery');
 const items=load('app/lib/navigation.ts').NAVIGATION_ITEMS;assert.equal(items.filter(i=>i.id==='statistics').length,1);assert.equal(items.some(i=>i.id==='participants'),false);
});

test('award results show community totals and individual counters while retaining distance and other metrics',()=>{
 const html=renderResults({4:'badges'});assert.match(html,/Celkové vyhodnocení odznaků/);assert.match(html,/Ranní ptáče/);assert.match(html,/Noční běh/);assert.match(html,/Počty jednotlivých odznaků/);assert.match(html,/6\.00 km/);assert.match(html,/Podle odznaků/);
});
