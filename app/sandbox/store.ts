// This module is only shipped on the isolated sandbox branch. No Firebase client exists here.
export const STORE_KEY = 'dlvp-isolated-sandbox-v1';
export const TEST_UID = 'sandbox-tester';
export type Row = Record<string, any>;
type State = { docs: Record<string, Row>; signedIn: boolean };
const listeners = new Set<() => void>();
let current: State | undefined;
const stamp = (date: Date) => ({seconds: Math.floor(date.getTime()/1000), nanoseconds:0});
export function seed(): State {
  const now = new Date(), docs: Record<string,Row> = {};
  for (const [uid,name] of [[TEST_UID,'TEST · Tvůj účet'],['sandbox-alena','TEST · Alena'],['sandbox-petr','TEST · Petr']]) {
    const profile = {nickname:name,email:uid+'@example.invalid',role:'user',defaultActivity:'běh',activityType:'běh',theme:'default',gradientEnabled:true,progressGoalsByType:{běh:{weekly:25,monthly:100}},socialNotifications:{likes:true,comments:true,teams:true,challenges:true}};
    docs['users/'+uid]=profile; docs['publicProfiles/'+uid]={nickname:name,activityType:'běh'};
  }
  const types=['běh','chůze','dřepy','kliky'];
  for(let i=0;i<32;i++) {
    const type=types[i%4], strength=i%4>1, date=new Date(now);date.setDate(date.getDate()-Math.floor(i/2));date.setHours(i%3===0?6:18,15,0,0);
    docs['runs/seed-'+i]={uid:i%3===0?'sandbox-alena':TEST_UID,nickname:i%3===0?'TEST · Alena':'TEST · Tvůj účet',type,km:strength?0:3+(i%5),minuty:strength?5:24+(i%10),tempo:strength?0:(24+i%10)/(3+i%5),repetitions:strength?20+i:undefined,timestamp:stamp(date),description:'Ukázkový záznam pro testování',imageUrls:i===1?['/sandbox-photo.svg']:[],likedBy:[],likeCount:0,commentCount:0};
  }
  docs['teams/demo-team']={name:'TEST · Pohyb pro radost',description:'Ukázkový tým. Všechna data jsou pouze v tomto prohlížeči.',createdBy:'sandbox-alena',managerId:'sandbox-alena',memberCount:1,stats:{runningKm:15,runningActivities:3,walkingKm:4,walkingActivities:1},type:'běh'};
  docs['teams/demo-team/members/sandbox-alena']={active:true,nickname:'TEST · Alena',joinedAt:stamp(now)};
  const start=new Date(now.getFullYear(),now.getMonth(),1),end=new Date(now.getFullYear(),now.getMonth()+1,0);
  const iso=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  docs['challenges/demo-challenge']={name:'TEST · Každý kilometr se počítá',description:'Ukázková měsíční výzva.',createdBy:'sandbox-alena',kind:'distance',activityType:'běh',goal:30,startDate:iso(start),endDate:iso(end),state:'active',participantCount:1};
  docs['challenges/demo-challenge/participants/sandbox-alena']={userId:'sandbox-alena',active:true,result:15,joinedAt:stamp(now)};
  return {docs,signedIn:false};
}
export function state():State {
  if(!current) {
    if(typeof window!=='undefined') {try {const raw=localStorage.getItem(STORE_KEY);if(raw){const value=JSON.parse(raw);if(value&&value.docs&&typeof value.signedIn==='boolean')current=value;}}catch{}}
    current ||= seed();
  }
  return current;
}
export function save(){
  if(typeof window!=='undefined') localStorage.setItem(STORE_KEY,JSON.stringify(state()));
  listeners.forEach(fn=>fn());
}
export function subscribe(fn:()=>void){listeners.add(fn);return()=>listeners.delete(fn);}
export function reset(){current=seed();save();}
export function rows(collection:string): (Row & {id:string})[]{return Object.entries(state().docs).filter(([key])=>key.startsWith(collection+'/')&&key.split('/').length===collection.split('/').length+1).map(([path,data])=>({id:path.split('/').at(-1)!,...data}));}
export function merge(a:Row,b:Row):Row {const out={...a};for(const [key,value]of Object.entries(b))out[key]=value&&typeof value==='object'&&!Array.isArray(value)&&!(value instanceof Date)?merge(out[key]||{},value):value;return out;}
export function put(path:string,data:Row,partial=true){state().docs[path]=partial?merge(state().docs[path]||{},data):data;save();}
export function remove(path:string){for(const key of Object.keys(state().docs))if(key===path||key.startsWith(path+'/'))delete state().docs[key];save();}
export const id=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'test-'+Date.now()+'-'+Math.random().toString(36).slice(2);
