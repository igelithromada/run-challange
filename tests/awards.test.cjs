const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module'),ts=require('typescript');
function load(file,deps={}){const filename=path.resolve(file),module={exports:{}},req=Module.createRequire(filename);const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:name=>{if(deps[name])return deps[name];if(name.startsWith('.'))for(const ext of ['.ts','.tsx']){const f=path.resolve(path.dirname(filename),name+ext);if(fs.existsSync(f))return load(f,deps);}return req(name);},Date,Map,Set,Intl,console},{filename});return module.exports;}
const {activityAwards,awardTotal}=load('app/lib/awards.ts');
const run=(id,date,km=1,type='běh')=>({id,uid:'u',timestamp:new Date(date),km,minuty:10,type});
const count=(awards,id)=>awards.find(a=>a.id===id).count;
const now=Date.parse('2026-11-18T00:00:00Z');
test('repeatable morning and night awards follow Prague winter time without overlap',()=>{
 const records=[run('early','2026-11-17T03:59:59Z'),run('morning1','2026-11-17T04:00:00Z'),run('morning2','2026-11-17T06:59:59Z'),run('day','2026-11-17T07:00:00Z'),run('evening','2026-11-17T19:59:59Z'),run('night','2026-11-17T20:00:00Z')];
 const awards=activityAwards(records,'běh',now);assert.equal(count(awards,'morning'),2);assert.equal(count(awards,'night'),2);assert.equal(count(awards,'first'),1);
 assert.equal(awardTotal(awards),5);
});
test('summer time, duplicates, future activities, invalid distances and walking are handled consistently',()=>{
 const record=run('m','2026-07-01T03:00:00Z');const records=[record,record,run('n','2026-07-01T19:00:00Z'),run('future','2027-01-01T05:00:00Z'),run('zero','2026-07-01T03:00:00Z',0),run('walk','2026-07-01T03:00:00Z',1,'chůze')];
 const awards=activityAwards(records,'běh',now);assert.equal(count(awards,'morning'),1);assert.equal(count(awards,'night'),1);
 const walk=activityAwards([run('walk','2026-07-01T19:00:00Z',1,'chůze')],'chůze',now);assert.equal(count(walk,'night'),1);assert.equal(walk.find(a=>a.id==='night').title,'Noční chůze');
});
test('editing or deleting an activity recalculates repeated counts, while historic streak awards remain earned',()=>{
 const records=Array.from({length:7},(_,i)=>run(String(i),`2026-11-${String(i+1).padStart(2,'0')}T05:00:00Z`,2));
 const awards=activityAwards(records,'běh',now);assert.equal(count(awards,'streak7'),1);assert.equal(count(awards,'morning'),7);assert.equal(count(awards,'km10'),1);
 assert.equal(count(activityAwards(records.slice(1),'běh',now),'morning'),6);
 assert.equal(count(activityAwards([{...records[0],timestamp:new Date('2026-11-01T12:00:00Z')},...records.slice(1)],'běh',now),'morning'),6);
});
test('community award standings use the same counters as personal progress and preserve metric ranking',()=>{
 const {resultPeople}=load('app/lib/results.ts');const records=[run('a1','2026-11-16T05:00:00Z'),run('a2','2026-11-16T21:00:00Z'),{...run('b1','2026-11-16T12:00:00Z',20),uid:'b'}];
 const people=resultPeople(records,{},'badges');assert.equal(people[0].uid,'u');assert.equal(people[0].awardCount,awardTotal(activityAwards(records.filter(r=>r.uid==='u'),'běh')));assert.equal(people[0].awardCount,3);assert.equal(people[1].awardCount,2);
 assert.equal(resultPeople(records,{},'km')[0].uid,'b');assert.equal(people.reduce((sum,p)=>sum+p.awardCount,0),5);
});
test('gallery is in tools and awards include every existing badge plus the two repeatable types',()=>{
 const {NAVIGATION_ITEMS}=load('app/lib/navigation.ts');assert.equal(NAVIGATION_ITEMS.find(i=>i.id==='gallery').group,'tools');
 const awards=activityAwards([]);assert.equal(awards.length,11);assert.equal(awards.filter(a=>a.repeatable).length,2);assert.equal(awardTotal(awards),0);
});

test('achievements count each activity family independently, including legacy records and exact kilometre thresholds', () => {
 const records = [
  ...Array.from({ length: 100 }, (_, index) => run('run'+index,'2026-11-16T12:00:00Z',.1)),
  run('walk','2026-11-16T12:00:00Z',9,'chůze'),
  { ...run('push','2026-11-16T12:00:00Z',0), type:undefined, activityType:'kliky', repetitions:500 },
  { ...run('squat','2026-11-16T12:00:00Z',0,'dřepy'), repetitions:99 },
  { ...run('deleting','2026-11-16T12:00:00Z',10,'chůze'), deleting:true },
 ];
 const running = activityAwards(records,'běh',now), walking = activityAwards(records,'chůze',now);
 const pushups = activityAwards(records,'kliky',now), squats = activityAwards(records,'dřepy',now);
 assert.equal(count(running,'km10'),1);
 assert.equal(count(walking,'km10'),0);
 assert.equal(count(pushups,'reps500'),1);
 assert.equal(count(squats,'reps100'),0);
 assert.equal(pushups.some(award => award.id.startsWith('km')),false);
 assert.equal(running.some(award => award.id.startsWith('reps')),false);
});
