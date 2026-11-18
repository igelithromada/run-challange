import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { parseActivityDate } from '../lib/runData';
import type { ChatRecord } from '../lib/chat';
import { ActivityCardHeading, ActivityCardStats } from './ActivityCardContent';

export default function ChatActivityPreview({ record, link = false }: { record: ChatRecord; link?: boolean }) {
  return <article className="activity-card activity-card-modern chat-record" aria-label="Sdílený záznam">
    <ActivityCardHeading nickname={record.nickname} activityType={record.type} date={parseActivityDate(record.timestamp)}/>
    <ActivityCardStats run={record} activityType={record.type}/>
    {link && <Link className="chat-record-link" href={`/#run-${encodeURIComponent(record.id)}`}>
      Otevřít záznam <ChevronRight size={16} aria-hidden="true"/>
    </Link>}
  </article>;
}
