const { test } = require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function load(file,dependencies={}) {const filename=path.resolve(file),module={exports:{}},req=Module.createRequire(filename);const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:name=>{if(dependencies[name])return dependencies[name];if(name.startsWith('.'))for(const ext of ['.ts','.tsx']){const f=path.resolve(path.dirname(filename),name+ext);if(fs.existsSync(f))return load(f,dependencies);}return req(name);},Date,Map,Set,console},{filename});return module.exports;}
const blank={__esModule:true,default:()=>null};
test('personal history requires only the user equality index',()=>{
  const api=load('app/lib/services/runs.ts',{'../firebase':{db:{},auth:{}},'firebase/firestore':{collection:()=>({name:'runs'}),where:(field,operator,value)=>({field,operator,value}),query:(source,...constraints)=>({source,constraints}),orderBy:()=>{throw new Error('must not require a composite index');}}});
  const result=api.personalHistoryQuery('owner');assert.equal(result.constraints.length,1);assert.equal(result.constraints[0].field,'uid');assert.equal(result.constraints[0].value,'owner');
});
test('real Firestore timestamps and toDate-only objects become graph points',()=>{
  const {Timestamp}=require('firebase/firestore'),{progressPoints}=load('app/lib/progressChart.ts');
  const date=new Date('2026-11-16T10:00:00');
  const points=progressPoints([{id:'a',km:1,minuty:10,timestamp:Timestamp.fromDate(date)},{id:'b',km:5.2,minuty:30,timestamp:{toDate:()=>date}}],'2026-11-01','2026-11-17',Date.parse('2026-11-18T00:00:00'));
  assert.equal(points.length,2);assert.equal(points[1].totalKm,6.2);
});
test('available activity data remains visible in the chart during a connection error',()=>{
  let index=0;const hooks={...React,useState:()=>[['2026-11-01','2026-11-17',null][index++],()=>{}]};
  const Chart=load('app/components/ProgressChart.tsx',{react:hooks}).default;
  const html=renderToStaticMarkup(React.createElement(Chart,{runs:[{id:'a',km:6.2,minuty:40,timestamp:{toDate:()=>new Date('2026-11-16T10:00:00')}}],activityType:'běh',error:true,loading:true}));
  assert.match(html,/class="progress-distance-chart"/);assert.match(html,/6,2 km/);assert.doesNotMatch(html,/Načítám aktivity/);assert.match(html,/poslední načtené aktivity/);
});
test('progress has weekday labels and no introductory text, goals editor or challenges link',()=>{
  const Page=load('app/progress/page.tsx',{'next/navigation':{useRouter:()=>({push(){}})},'firebase/auth':{onAuthStateChanged(){return()=>{};}},'../lib/firebase':{auth:{}},'../lib/useSharedFirestoreQuery':{useSharedFirestoreQuery:()=>({data:[],loading:false,error:null})},'../lib/services/runs':{personalHistoryQuery:()=>({})},'../lib/useRunningPointsRules':{useRunningPointsRules:()=>({rules:load('app/lib/runningPointsConfig.ts').RUN_POINTS,error:false})},'../components/Navbar':blank,'../components/Sidebar':blank,'../components/LoadingSkeleton':blank,'../components/ActivityTypeSelector':blank,'../components/ProgressChart':blank}).default;
  const html=renderToStaticMarkup(React.createElement(Page));
  assert.doesNotMatch(html,/TVŮJ POHYB|Každý kilometr|Moje cíle|Zobrazit výzvy/);
  for(const day of ['Po','Út','St','Čt','Pá','So','Ne'])assert.ok(html.includes(`<span>${day}</span>`));
  assert.match(html,/Osobní rekordy/);
  assert.match(html,/První běžecký den týdne je bez bonusu/);
});
const text=n=>typeof n==='number'?String(n):typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
function find(n,p){if(!n)return;if(Array.isArray(n)){for(const c of n){const r=find(c,p);if(r)return r;}return;}if(p(n))return n;return find(n.props?.children,p);}
test('trainer goals load existing walking targets and save only that activity category',async()=>{
  let hook=0;const slots=[],effects=[],writes=[];let savedMonthly;
  const hooks={useState:initial=>{const i=hook++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useEffect:(fn,deps)=>{const i=hook++;if(!slots[i]){slots[i]=true;effects.push(fn);}}};
  const Goals=load('app/components/TrainingGoals.tsx',{react:hooks,'../lib/services/users':{getUserProfile:async()=>({progressGoalsByType:{běh:{weekly:25,monthly:100},chůze:{weekly:50,monthly:200}}}),mergeUserProfile:async(uid,patch)=>writes.push({uid,patch})}}).default;
  const render=()=>{hook=0;const tree=Goals({uid:'owner',type:'chůze',runs:[],onSaved:value=>savedMonthly=value});effects.splice(0).forEach(fn=>fn());return tree;};
  render();await new Promise(r=>setImmediate(r));
  let tree=render();const weekly=find(tree,n=>n.type==='label'&&text(n).includes('Týdenní')),monthly=find(tree,n=>n.type==='label'&&text(n).includes('Měsíční'));
  assert.equal(find(weekly,n=>n.type==='input').props.value,'50');assert.equal(find(monthly,n=>n.type==='input').props.value,'200');
  find(weekly,n=>n.type==='input').props.onChange({target:{value:'60'}});find(monthly,n=>n.type==='input').props.onChange({target:{value:'240'}});
  tree=render();find(tree,n=>n.type==='button'&&text(n).includes('Uložit cíle')).props.onClick();await new Promise(r=>setImmediate(r));
  assert.equal(writes[0].uid,'owner');assert.equal(writes[0].patch.progressGoalsByType.chůze.weekly,60);assert.equal(writes[0].patch.progressGoalsByType.běh,undefined);assert.equal(savedMonthly,240);
});

test('calendar shows day details for every activity on that day and can navigate back and forward',()=>{
  let index=0;const values=[];const hooks={useMemo:fn=>fn(),useState:initial=>{const i=index++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return[values[i],v=>values[i]=typeof v==='function'?v(values[i]):v];}};
  const Calendar=load('app/components/ActivityCalendar.tsx',{react:hooks}).default;
  const now=new Date();
  const render=()=>{index=0;return Calendar({runs:[{id:'1',km:2,minuty:10,timestamp:now},{id:'2',km:3,minuty:20,timestamp:now}]});};
  let tree=render(),cell=find(tree,n=>n.type==='button'&&n.props['aria-label']?.endsWith(', 5 km'));
  assert.ok(cell);cell.props.onClick();tree=render();assert.match(text(find(tree,n=>n.type==='output')),/5 km · 2 aktivit/);
  find(tree,n=>n.props?.['aria-label']==='Předchozí měsíc').props.onClick();tree=render();
  assert.equal(find(tree,n=>n.props?.['aria-label']==='Další měsíc').props.disabled,false);
  assert.doesNotMatch(text(find(tree,n=>n.type==='output')),/5 km/);
  find(tree,n=>n.props?.['aria-label']==='Další měsíc').props.onClick();tree=render();assert.equal(find(tree,n=>n.props?.['aria-label']==='Další měsíc').props.disabled,true);
});
