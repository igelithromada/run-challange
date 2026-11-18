import Image from 'next/image';
import type { ChatActivity } from '../lib/chat';

function Thumbnails({ activity }: { activity: ChatActivity }) {
  return activity.thumbnails.map((url, index) => (
    <Image key={url} src={url} width={96} height={96} unoptimized
      alt={`Fotka ${index + 1} ze záznamu`} />
  ));
}

export default function ChatActivityPreview({ activity, select }: {
  activity: ChatActivity;
  select?: () => void;
}) {
  if (select) {
    return <button type="button" className="chat-photo-strip chat-photo-option" onClick={select}
      aria-label={`Připojit fotky ze záznamu (${activity.thumbnails.length})`}>
      <Thumbnails activity={activity} />
    </button>;
  }

  return <div className="chat-photo-strip" aria-label="Fotky ze záznamu">
    <Thumbnails activity={activity} />
  </div>;
}
