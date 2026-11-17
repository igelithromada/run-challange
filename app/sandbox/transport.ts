import {id,rows,state,put,remove,save,TEST_UID,merge} from './store';
let installed=false;
const reply=(data:any,status=200)=>Response.json(data,{status});
const profile=()=>state().docs['users/'+TEST_UID];
const numeric=(n:any)=>Number(n)||0;
const day=(v:any)=>new Date(typeof v==='object'?v.seconds*1000:v).toISOString().slice(0,10);
function refreshTotals(){
 const runs=rows('runs');
 for(const team of rows('teams')){
  const stats:any={runningKm:0,runningActivities:0,walkingKm:0,walkingActivities:0,squatRepetitions:0,squatActivities:0,pushupRepetitions:0,pushupActivities:0};
  for(const run of runs.filter(r=>r.teamId===team.id)){
   const fields:any={běh:['runningKm','runningActivities'],chůze:['walkingKm','walkingActivities'],dřepy:['squatRepetitions','squatActivities'],kliky:['pushupRepetitions','pushupActivities']};const f=fields[run.type];if(f){stats[f[0]]+=numeric(f[0].endsWith('Km')?run.km:run.repetitions);stats[f[1]]++;}
  }
  state().docs['teams/'+team.id]={...team,stats,memberCount:rows('teams/'+team.id+'/members').filter(r=>r.active).length};
 }
 for(const challenge of rows('challenges')){
  let total=0;
  const participants=rows('challenges/'+challenge.id+'/participants').filter(p=>p.active);
  for(const participant of participants){
   const eligible=runs.filter(r=>r.uid===participant.id&&r.type===challenge.activityType&&day(r.timestamp)>=challenge.startDate&&day(r.timestamp)<=challenge.endDate);
   const result=challenge.kind==='activities'?eligible.length:challenge.kind==='activeDays'?new Set(eligible.map(r=>day(r.timestamp))).size:eligible.reduce((s,r)=>s+numeric(challenge.kind.toLowerCase().includes('repetition')?r.repetitions:r.km),0);
   state().docs['challenges/'+challenge.id+'/participants/'+participant.id]={...participant,result};total+=result;
  }
  state().docs['challenges/'+challenge.id]={...challenge,sharedProgress:total,participantCount:participants.length};
 }
 save();
}
export async function sandboxRequest(path:string,method:string,body:any,search:URLSearchParams):Promise<Response>{
 if(!state().signedIn)return reply({error:'Nejdřív vstup jako tester.'},401);
 if((path==='/api/routes/recommended'||path==='/api/admin/routes')&&method==='GET')return reply({routes:[{id:'sandbox-route',name:'TEST · Ukázkový okruh',description:'Syntetická trasa pro test mapy a výškového profilu.',distance:'1,8 km',gpxUrl:'/sandbox-route.gpx',groupId:'sandbox',groupTitle:'Testovací trasy'}]});
 if(path==='/api/routes/gpx')return new Response(await (await fetch('/sandbox-route.gpx')).text(),{headers:{'Content-Type':'application/gpx+xml'}});
 if(path==='/api/media/upload'){
  const file=body instanceof FormData?body.get('file'):null;if(!(file instanceof Blob))return reply({error:'Chybí fotografie.'},400);
  const url=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});
  return reply({secureUrl:url,publicId:'sandbox-'+id()});
 }
 if(path==='/api/community/read'){
  const resource=body.resource,key=String(body.id||'');
  let data:any=null;
  if(resource==='teams'||resource==='challenges')data=rows(resource);
  else if(resource==='team'||resource==='challenge')data=state().docs[(resource==='team'?'teams':'challenges')+'/'+key]?{id:key,...state().docs[(resource==='team'?'teams':'challenges')+'/'+key]}:null;
  else if(resource==='teamMemberships')data=rows('teams').filter(t=>state().docs[`teams/${t.id}/members/${TEST_UID}`]?.active).map(t=>t.id);
  else if(resource==='teamMembers')data=rows(`teams/${key}/members`).filter(p=>p.active);
  else if(resource==='challengeParticipants')data=rows(`challenges/${key}/participants`).filter(p=>p.active);
  else if(resource==='challengeMembership')data=state().docs[`challenges/${key}/participants/${TEST_UID}`]||null;
  return reply({data});
 }
 if(path==='/api/runs/create'){
  const run=body.run||{},key=body.submissionId?'submission-'+body.submissionId:id();
  if(!['běh','chůze','dřepy','kliky'].includes(run.type))return reply({error:'Vyber typ aktivity.'},400);
  if((['dřepy','kliky'].includes(run.type)?numeric(run.repetitions):numeric(run.km))<=0)return reply({error:'Zadej kladnou hodnotu aktivity.'},400);
  const team=rows('teams').find(t=>t.type===run.type&&state().docs[`teams/${t.id}/members/${TEST_UID}`]?.active);
  const timestamp=run.timestamp instanceof Date?{seconds:run.timestamp.getTime()/1000}:typeof run.timestamp==='string'?{seconds:new Date(run.timestamp).getTime()/1000}:run.timestamp;
  put('runs/'+key,{...run,uid:TEST_UID,nickname:profile().nickname,timestamp,teamId:team?.id||'',likeCount:0,commentCount:0,likedBy:[]},false);refreshTotals();return reply({ok:true,id:key});
 }
 if(path==='/api/runs/update'){put('runs/'+body.id,body.updates);refreshTotals();return reply({ok:true});}
 if(path==='/api/runs/delete'){remove('runs/'+(body.id||body.runId));refreshTotals();return reply({ok:true});}
 if(path==='/api/runs/photo'){
  const run=state().docs['runs/'+body.runId];if(!run)return reply({error:'Záznam neexistuje.'},404);
  const images=[...(run.imageUrls||[])];images.splice(body.index,1);put('runs/'+body.runId,{imageUrls:images,imageUrl:images[0]||''});return reply({ok:true});
 }
 if(path==='/api/runs/social'){
  const key=String(body.runId||search.get('runId')||''),run=state().docs['runs/'+key];if(!run)return reply({error:'Záznam neexistuje.'},404);
  let likedBy=run.likedBy||[],comments=run.comments||[];
  if(body.action==='like')likedBy=likedBy.includes(TEST_UID)?likedBy.filter((u:string)=>u!==TEST_UID):[...likedBy,TEST_UID];
  let comment:any;
  if(body.action==='comment'){comment={id:id(),uid:TEST_UID,nickname:profile().nickname,text:String(body.text||''),createdAt:new Date().toISOString(),mine:true};comments=[...comments,comment];}
  if(body.action==='comment_update'){comments=comments.map((c:any)=>c.id===body.commentId&&c.uid===TEST_UID?{...c,text:body.text}:c);comment=comments.find((c:any)=>c.id===body.commentId);}
  if(body.action==='comment_delete')comments=comments.filter((c:any)=>c.id!==body.commentId||c.uid!==TEST_UID);
  if(method!=='GET')put('runs/'+key,{likedBy,comments,likeCount:likedBy.length,commentCount:comments.length});
  return reply({ok:true,liked:likedBy.includes(TEST_UID),likeCount:likedBy.length,commentCount:comments.length,likes:likedBy.map((uid:string)=>({uid,...state().docs['publicProfiles/'+uid]})),comments,comment,isAdmin:false});
 }
 if(path==='/api/teams/manage'||path==='/api/challenges/manage'){
  if(path.includes('/challenges/')&&body.action==='refresh'){for(const c of rows('challenges')){const today=day(new Date().toISOString());state().docs['challenges/'+c.id]={...c,state:c.startDate>today?'planned':c.endDate<today?'completed':'active'};}refreshTotals();return reply({ok:true});}
  const teams=path.includes('/teams/'),collection=teams?'teams':'challenges',key=String((teams?body.teamId:body.challengeId)||id()),action=body.action,sub=teams?'members':'participants';
  if(action==='listMine'){const items=rows(collection).filter(t=>state().docs[`${collection}/${t.id}/${sub}/${TEST_UID}`]?.active);return reply({ok:true,items,hasMore:false});}
  if(action==='create'){
   if(!String(body.name||'').trim())return reply({error:'Zadej název.'},400);
   if(!teams&&(!body.startDate||body.startDate>body.endDate||numeric(body.goal)<=0))return reply({error:'Zkontroluj cíl a období výzvy.'},400);
   const data={...body,id:key,createdBy:TEST_UID,managerId:TEST_UID,participantCount:1,memberCount:1,...(!teams?{state:body.startDate>day(new Date().toISOString())?'planned':body.endDate<day(new Date().toISOString())?'completed':'active'}:{})};delete data.action;
   put(collection+'/'+key,data,false);put(`${collection}/${key}/${sub}/${TEST_UID}`,{active:true,userId:TEST_UID,nickname:profile().nickname,joinedAt:{seconds:Date.now()/1000},result:0},false);refreshTotals();return reply({ok:true,id:key,[teams?'team':'challenge']:state().docs[collection+'/'+key]});
  }
  if(!state().docs[collection+'/'+key])return reply({error:'Položka neexistuje.'},404);
  if(action==='join'||action==='leave'){put(`${collection}/${key}/${sub}/${TEST_UID}`,{active:action==='join',userId:TEST_UID,nickname:profile().nickname,joinedAt:{seconds:Date.now()/1000},result:0});refreshTotals();return reply({ok:true});}
  if(state().docs[collection+'/'+key].createdBy!==TEST_UID)return reply({error:'Upravovat můžeš vlastní testovací položky.'},403);
  if(action==='edit'||action==='rename'){put(collection+'/'+key,body);refreshTotals();return reply({ok:true});}
  if(action==='delete'){remove(collection+'/'+key);return reply({ok:true});}
 }
 if(path.startsWith('/api/settings/')){
  if(method==='GET')return reply({deliveryReady:false});
  const changes=path.endsWith('/profile')?{...body}:body;
  put('users/'+TEST_UID,changes);
  if(path.endsWith('/profile'))put('publicProfiles/'+TEST_UID,changes);
  return reply({ok:true,...changes});
 }
 if(path==='/api/trainer/plan'){
  const plan=body.plan;if(!plan)return reply({error:'Chybí plán.'},400);
  put('users/'+TEST_UID,{personalTrainerPlans:{[plan.type]:{[plan.monthKey]:plan}},personalTrainerPlan:plan});return reply({ok:true,plan});
 }
 if(path==='/api/notifications')return reply({notifications:[],unreadCount:0,ok:true});
 if(path==='/api/notifications/subscribe')return reply({error:'Push notifikace se v místním testu neposílají.'},409);
 if(path==='/api/weather/location')return reply({name:'Testovací poloha GPS',label:'Testovací poloha GPS'});
 return reply({error:'Tato serverová operace není v místním testu dostupná.'},501);
}
export function installSandboxFetch(){
 if(installed||typeof window==='undefined')return;installed=true;
 const original=window.fetch.bind(window);
 window.fetch=async(input:any,init?:RequestInit)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,window.location.origin);
  if(url.origin==='https://tile.openstreetmap.org' && (!init?.method||init.method==='GET'))return original(input,init);
  if(url.origin!==window.location.origin){throw new Error('Testovací verze nepovoluje vzdálené datové požadavky.');}
  if(!url.pathname.startsWith('/api/')||url.pathname==='/api/weather')return original(input,init);
  let body:any={};if(init?.body instanceof FormData)body=init.body;else if(typeof init?.body==='string'){try{body=JSON.parse(init.body);}catch{return reply({error:'Neplatná data.'},400);}}
  try{return await sandboxRequest(url.pathname,(init?.method||'GET').toUpperCase(),body,url.searchParams);}catch(error){return reply({error:error instanceof Error?error.message:'Testovací data nelze uložit.'},507);}
 };
}
