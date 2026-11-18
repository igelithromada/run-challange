import type {ActivityType} from '../types';
export type ChatActivity={id:string;type:ActivityType;amount:number;minutes:number;date:string|null;description:string;imageUrl:string};
export type ChatReply={id:string;nickname:string;text:string};
/** Project only public activity fields. Do not copy email, GPS or private profile data. */
export function chatActivity(id:string,data:Record<string,any>|undefined):ChatActivity|null{
 if(!data||data.deleting===true)return null;
 const type:ActivityType=['běh','chůze','dřepy','kliky'].includes(data.type)?data.type:'běh';
 const value=data.timestamp;
 const date=value?.toDate?.()||(typeof value?.seconds==='number'?new Date(value.seconds*1000):typeof value==='string'?new Date(value):value instanceof Date?value:null);
 const images=[...(Array.isArray(data.imageUrls)?data.imageUrls:[]),data.imageUrl];
 return {id,type,amount:Math.max(0,Number(type==='dřepy'||type==='kliky'?data.repetitions:data.km)||0),minutes:Math.max(0,Number(data.minuty)||0),date:date&&!Number.isNaN(date.getTime())?date.toISOString():null,description:String(data.description||'').slice(0,160),imageUrl:images.find(url=>typeof url==='string'&&url.startsWith('https://res.cloudinary.com/'))||''};
}
