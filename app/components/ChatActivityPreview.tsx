import Link from 'next/link';
import {ActivityTypeIcon} from './ActivityTypeSelector';
import {activityLabel,isStrengthActivity} from '../lib/activity';
import {cloudinaryImageUrl} from '../lib/imageUrl';
import type {ChatActivity} from '../lib/chat';
export default function ChatActivityPreview({activity,select,passive=false}:{activity:ChatActivity;select?:()=>void;passive?:boolean}){
 const content=<><span className="chat-activity-icon"><ActivityTypeIcon type={activity.type} size={24}/></span><span className="chat-activity-copy"><strong>{activityLabel(activity.type)} · {activity.amount.toLocaleString('cs-CZ')} {isStrengthActivity(activity.type)?'opakování':'km'}</strong><small>{activity.date?new Date(activity.date).toLocaleString('cs-CZ',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'}):'Bez data'}{activity.minutes>0?' · '+Math.floor(activity.minutes)+' min':''}</small>{activity.description&&<span>{activity.description}</span>}</span>{activity.imageUrl&&<img src={cloudinaryImageUrl(activity.imageUrl,160)} alt="" loading="lazy"/>}</>;
 return passive?<div className="chat-activity-preview">{content}</div>:select?<button type="button" className="chat-activity-preview" onClick={select}>{content}</button>:<Link className="chat-activity-preview" href={'/#run-'+encodeURIComponent(activity.id)} aria-label={'Otevřít záznam: '+activityLabel(activity.type)}>{content}</Link>;
}
