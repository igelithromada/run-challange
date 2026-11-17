import type { ActivityType } from "../types";
export type FormDraft = { km:string; minutes:string; seconds:string; date:string; description:string; submissionId?:string; savedAt:number };
export type RecorderDraft = { elapsed:number; distance:number; running:boolean; savedAt:number };
const key=(kind:string,uid:string,type:ActivityType)=>`lhota-recovery-v1:${uid}:${type}:${kind}`;
function read<T>(kind:string,uid:string|undefined,type:ActivityType):T|null {
  if(!uid)return null;
  try {const value=localStorage.getItem(key(kind,uid,type));return value?JSON.parse(value) as T:null;} catch{return null;}
}
function write(kind:string,uid:string|undefined,type:ActivityType,value:unknown) {
  if(!uid)return false;
  try {localStorage.setItem(key(kind,uid,type),JSON.stringify(value));return true;} catch{return false;}
}
export const readFormDraft=(uid:string|undefined,type:ActivityType)=>{
  const d=read<FormDraft>("form",uid,type);
  return d&&typeof d.km==="string"&&typeof d.minutes==="string"&&typeof d.seconds==="string"&&typeof d.date==="string"&&typeof d.description==="string"?d:null;
};
export const saveFormDraft=(uid:string|undefined,type:ActivityType,draft:FormDraft)=>write("form",uid,type,draft);
export const readRecorderDraft=(uid:string|undefined,type:ActivityType)=>{
  const d=read<RecorderDraft>("gps",uid,type);
  return d&&Number.isFinite(d.elapsed)&&d.elapsed>=0&&Number.isFinite(d.distance)&&d.distance>=0&&(d.elapsed>0||d.distance>0)?d:null;
};
export const saveRecorderDraft=(uid:string|undefined,type:ActivityType,draft:RecorderDraft)=>write("gps",uid,type,draft);
export function clearRecovery(kind:"form"|"gps",uid:string|undefined,type:ActivityType) {if(uid)try{localStorage.removeItem(key(kind,uid,type));}catch{}}

// Photos live in IndexedDB, not JSON/localStorage, so large camera files fit.
function database():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==="undefined"){reject(new Error("Úložiště fotografií není dostupné."));return;}
    const request=indexedDB.open("lhota-activity-drafts",1);
    request.onupgradeneeded=()=>request.result.createObjectStore("photos");
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
export async function draftPhotos(uid:string,type:ActivityType,files?:File[]|null):Promise<File[]> {
  const db=await database(), id=key("photos",uid,type);
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("photos",files===undefined?"readonly":"readwrite"),store=tx.objectStore("photos");
    const request=files===undefined?store.get(id):files===null?store.delete(id):store.put(files.map(file=>({blob:file,name:file.name,lastModified:file.lastModified})),id);
    tx.oncomplete=()=>{db.close();resolve(files===undefined?(Array.isArray(request.result)?request.result.filter(value=>value?.blob&&typeof value.name==="string").map(value=>new File([value.blob],value.name,{type:value.blob.type,lastModified:value.lastModified})):[]):files||[]);};
    tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error);};
  });
}
