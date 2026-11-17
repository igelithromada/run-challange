import {state,put,rows,subscribe} from './store';
export class Timestamp {seconds:number;nanoseconds:number;constructor(seconds:number,nanoseconds=0){this.seconds=seconds;this.nanoseconds=nanoseconds;}static fromDate(d:Date){return new Timestamp(Math.floor(d.getTime()/1000));}static now(){return Timestamp.fromDate(new Date());}toDate(){return new Date(this.seconds*1000+this.nanoseconds/1e6);}toMillis(){return this.toDate().getTime();}}
export const serverTimestamp=()=>Timestamp.now();
export const collection=(_db:any,...parts:string[])=>({path:parts.join('/'),constraints:[]});
export const doc=(_db:any,...parts:string[])=>({path:parts.join('/'),id:parts.at(-1)});
export const where=(field:string,op:string,value:any)=>({kind:'where',field,op,value});
export const orderBy=(field:string,direction='asc')=>({kind:'order',field,direction});
export const limit=(count:number)=>({kind:'limit',count});
export const startAfter=(snapshot:any)=>({kind:'after',id:snapshot.id});
export const query=(source:any,...constraints:any[])=>({...source,constraints:[...(source.constraints||[]),...constraints]});
const value=(v:any):any=>v instanceof Date?v.getTime():v&&typeof v.seconds==='number'?v.seconds*1000:v;
const snap=(row:any)=>({id:row.id,data:()=>{const {id,...data}=row;return data;},exists:()=>true,metadata:{fromCache:true,hasPendingWrites:false}});
export async function getDoc(ref:any){const data=state().docs[ref.path];return {id:ref.id,exists:()=>!!data,data:()=>data};}
function snapshot(source:any){
 let data=rows(source.path);for(const c of source.constraints||[])if(c.kind==='where')data=data.filter((r:any)=>{const a=value(r[c.field]),b=value(c.value);return c.op==='=='?a===b:c.op==='>='?a>=b:c.op==='<='?a<=b:c.op==='>'?a>b:c.op==='<'?a<b:c.op==='in'?c.value.includes(a):c.op==='array-contains'?r[c.field]?.includes(b):false;});
 for(const c of source.constraints||[])if(c.kind==='order')data.sort((a:any,b:any)=>{const x=value(a[c.field]),y=value(b[c.field]);return (x<y?-1:x>y?1:a.id.localeCompare(b.id))*(c.direction==='desc'?-1:1);});
 for(const c of source.constraints||[]){if(c.kind==='after')data=data.slice(data.findIndex(r=>r.id===c.id)+1);if(c.kind==='limit')data=data.slice(0,c.count);}
 const docs=data.map(snap);return {docs,size:docs.length,empty:!docs.length,forEach:(fn:any)=>docs.forEach(fn),metadata:{fromCache:true,hasPendingWrites:false}};
}
export async function getDocs(source:any){return snapshot(source);}
export function onSnapshot(source:any,...args:any[]){const callback=args.find(a=>typeof a==='function');const emit=()=>callback(snapshot(source));queueMicrotask(emit);return subscribe(emit);}
export async function setDoc(ref:any,data:any,options?:any){put(ref.path,data,!!options?.merge);}
export async function updateDoc(ref:any,data:any){put(ref.path,data);}
