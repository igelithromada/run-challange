import { activityThumbnailUrl } from './imageUrl';

export type ChatActivity = { id: string; thumbnails: string[] };
export type ChatReply = { id: string; nickname: string; text: string };
export type ChatUnread = {
  version: string;
  enabled: boolean;
  unread?: number;
  newestIncomingAt?: number;
};

export function chatActivity(id: string, data: Record<string, unknown> | undefined): ChatActivity | null {
  if (!data || data.deleting === true) return null;

  const images = [...(Array.isArray(data.imageUrls) ? data.imageUrls : []), data.imageUrl];
  const thumbnails = [...new Set(images
    .filter((image): image is string => typeof image === 'string')
    .map(image => activityThumbnailUrl(image, { width: 192, height: 192 }))
    .filter(Boolean))].slice(0, 6);

  return thumbnails.length ? { id, thumbnails } : null;
}
