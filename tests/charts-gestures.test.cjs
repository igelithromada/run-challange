const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module'),ts=require('typescript');
function load(file,dependencies={},globals={}) {
  const filename=path.resolve(file),module={exports:{}},req=Module.createRequire(filename);
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require:name=>{if(dependencies[name])return dependencies[name];if(name.startsWith('.'))for(const ext of ['.ts','.tsx']){const source=path.resolve(path.dirname(filename),name+ext);if(fs.existsSync(source))return load(source,dependencies,globals);}return req(name);},console,Date,Map,Set,...globals},{filename});return module.exports;
}
const gestures=load('app/lib/avatarGesture.ts'),{avatarCrop}=load('app/lib/avatarCrop.ts');
test('pinch zoom preserves the image under the fingers, clamps zoom, and one finger pans without zooming',()=>{
  const start={zoom:1,x:0,y:0},from=[{x:0,y:0},{x:100,y:0}],to=[{x:-50,y:0},{x:150,y:0}];
  const next=gestures.moveAvatar(4000,3000,start,from,to);assert.equal(next.zoom,2);
  const a=avatarCrop(4000,3000,1,0,0),b=avatarCrop(4000,3000,next.zoom,next.x,next.y);
  assert.ok(Math.abs((50-a.offsetX)/(a.displayWidth/4000)-(50-b.offsetX)/(b.displayWidth/4000))<.00001);
  const pan=gestures.moveAvatar(4000,3000,next,[{x:0,y:0}],[{x:20,y:10}]);assert.equal(pan.zoom,2);assert.ok(pan.x>next.x);
  assert.equal(gestures.moveAvatar(4000,3000,start,from,[{x:-1000,y:0},{x:1000,y:0}]).zoom,3);
  assert.equal(gestures.moveAvatar(4000,3000,start,from,[{x:0,y:0},{x:1,y:0}]).zoom,1);
});
test('route profile selection follows travelled distance, not GPX point index, including repeated laps',()=>{
  const {routeSamples,nearestDistance}=load('app/lib/routeProfile.ts');
  const coords=[[18,49],[18.00001,49],[18.01,49]];
  const samples=routeSamples(coords,[300,null,400],2),one=samples[2].distanceKm;
  assert.ok(Math.abs(samples.at(-1).distanceKm-one*2)<1e-9);assert.equal(samples[3].distanceKm,one);
  assert.equal(nearestDistance(samples,one*.4),1,'middle of the distance is not middle of the point list');
  assert.deepEqual([...samples[nearestDistance(samples,samples.at(-1).distanceKm)].coordinate],coords.at(-1));
  assert.equal(nearestDistance(samples,-1),0);assert.equal(nearestDistance([],2),-1);
});
test('long GPX display retains peaks but selection still uses the full-resolution track',()=>{
  const {profileDisplay}=load('app/lib/routeProfile.ts');
  const points=Array.from({length:10000},(_,i)=>({coordinate:[18,49],distanceKm:i/1000,elevation:i===5050?1000:100}));
  const display=profileDisplay(points);assert.ok(display.length<600);assert.ok(display.some(s=>s.elevation===1000));assert.equal(display[0],points[0]);assert.equal(display.at(-1),points.at(-1));
});
test('progress points retain every activity, filter full date boundaries, sort and accumulate km and duration correctly',()=>{
  const {progressPoints,nearestProgressPoint}=load('app/lib/progressChart.ts');
  const runs=[{id:'b',km:'5',minuty:'30',timestamp:new Date('2026-11-12T10:00:00')},{id:'a',km:2,minuty:14,timestamp:new Date('2026-11-11T00:00:00')},{id:'c',km:1,minuty:7,timestamp:new Date('2026-11-12T23:59:59.999')},{id:'old',km:100,minuty:100,timestamp:new Date('2026-11-10T23:59:59.999')},{id:'future',km:10,minuty:30,timestamp:new Date('2026-11-13T01:00:00')},{id:'bad',km:NaN,minuty:10,timestamp:new Date('2026-11-11T01:00:00')}];
  const points=progressPoints(runs,'2026-11-11','2026-11-12',Date.parse('2026-11-14T00:00:00'));
  assert.deepEqual(Array.from(points,p=>p.id),['a','b','c']);assert.equal(points[2].totalKm,8);assert.equal(points[2].totalMinutes,51);assert.equal(points[2].count,3);
  const start=Date.parse('2026-11-11T00:00:00'),end=Date.parse('2026-11-12T23:59:59.999');
  assert.equal(nearestProgressPoint(points,start,end,(points[1].time-start)/(end-start)),1);
  assert.equal(progressPoints(runs,'2026-11-12','2026-11-11').length,0);
  assert.equal(progressPoints([{...runs[0],minuty:'bad'}],'2026-11-11','2026-11-12',end)[0].completeTime,false);
});
const find=(node,predicate)=>{if(!node)return;if(Array.isArray(node)){for(const n of node){const v=find(n,predicate);if(v)return v;}return;}if(predicate(node))return node;return find(node.props?.children,predicate);};
function hooksHarness(initial=[]) {let cursor=0,state=0;const slots=[];return {reset(){cursor=0;state=0;},hooks:{useState:value=>{const i=cursor++,s=state++;if(!(i in slots))slots[i]=s<initial.length?initial[s]:typeof value==='function'?value():value;return[slots[i],next=>slots[i]=typeof next==='function'?next(slots[i]):next];},useRef:value=>{const i=cursor++;return slots[i]||(slots[i]={current:value});},useEffect(){},useMemo:fn=>fn()}};}
test('avatar supports two pointers and continuing a one-finger drag after lifting one finger, with no sliders',()=>{
  const h=hooksHarness(['blob:test',{width:4000,height:3000},false,{zoom:1,x:0,y:0},'']);
  const Avatar=load('app/components/AvatarCropper.tsx',{react:h.hooks}).default;
  const render=()=>{h.reset();return Avatar({file:{},busy:false,onCancel(){},onSave:async()=>{}});};
  const target={setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:260,height:260})};
  const event=(pointerId,clientX,clientY)=>({pointerId,clientX,clientY,currentTarget:target});
  let tree=render(),frame=find(tree,n=>n.props?.className==='avatar-crop-frame');assert.equal(find(tree,n=>n.type==='input'),undefined);
  frame.props.onPointerDown(event(1,80,130));frame.props.onPointerDown(event(2,180,130));frame.props.onPointerMove(event(2,230,130));
  tree=render();const before=find(tree,n=>n.type==='img').props.style;assert.ok(before.width>346.7);
  frame=find(tree,n=>n.props?.className==='avatar-crop-frame');frame.props.onPointerUp(event(2,230,130));frame.props.onPointerMove(event(1,100,140));
  const after=find(render(),n=>n.type==='img').props.style;assert.equal(after.width,before.width);assert.notEqual(after.transform,before.transform);
});
test('scrubbing the route profile sends an interpolated coordinate to the map',()=>{
  const {routeSamples}=load('app/lib/routeProfile.ts'),samples=routeSamples([[18,49],[18.00001,49],[18.01,49]],[300,310,400]);
  const h=hooksHarness();let selected;
  const Profile=load('app/components/RouteElevationProfile.tsx',{react:h.hooks}).default;
  h.reset();const tree=Profile({samples,gain:100,min:300,max:400,onSelect:s=>selected=s});
  const svg=find(tree,n=>n.type==='svg');svg.props.onPointerDown({pointerId:1,clientX:40,currentTarget:{setPointerCapture(){},getBoundingClientRect:()=>({left:0,width:100})}});
  assert.ok(Math.abs(selected.distanceKm-samples.at(-1).distanceKm*.4)<1e-9);assert.ok(Math.abs(selected.coordinate[0]-18.004)<1e-7);assert.equal(selected.coordinate[1],49);
});
test('scrubbing a progress point changes the readout to the matching activity',()=>{
  const runs=[{id:'a',km:2,minuty:14,timestamp:new Date('2026-11-11T10:00:00')},{id:'b',km:5,minuty:30,timestamp:new Date('2026-11-12T10:00:00')}];
  const h=hooksHarness(['2026-11-11','2026-11-12',null]);
  const Chart=load('app/components/ProgressChart.tsx',{react:h.hooks}).default;
  const render=()=>{h.reset();return Chart({runs,activityType:'běh'});};
  const slider=find(render(),n=>n.type==='svg');const start=Date.parse('2026-11-11T00:00:00'),end=Date.parse('2026-11-12T23:59:59.999');
  slider.props.onPointerDown({pointerId:1,clientX:2+(runs[0].timestamp.getTime()-start)/(end-start)*96,clientY:50,currentTarget:{setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})}});
  assert.match(find(render(),n=>n.type==='svg').props['aria-valuetext'],/aktivita 2 km, celkem 2 km/);
});
