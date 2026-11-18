import { activityThumbnailUrl } from './imageUrl';

export const CHAT_CHANGED = 'dolni-lhota:chat-changed';
export type ChatActivity = { id: string; thumbnails: string[] };
export type ChatReply = { id: string; nickname: string; text: string };
export type ChatUnread = {
  version: string;
  enabled: boolean;
  unread?: number;
  newestIncomingAt?: number;
};

export function chatPhotos(data: Record<string, unknown> | undefined) {
  if (!data || data.deleting === true) return [];
  const images = [...(Array.isArray(data.imageUrls) ? data.imageUrls : []), data.imageUrl];
  const photos = new Map<string, string>();
  for (const url of images) {
    if (typeof url !== 'string') continue;
    const thumbnail = activityThumbnailUrl(url, { width: 192, height: 192 });
    if (thumbnail && !photos.has(thumbnail)) photos.set(thumbnail, url);
    if (photos.size === 6) break;
  }
  return Array.from(photos, ([thumbnail, url]) => ({ thumbnail, url }));
}

export function chatActivity(id: string, data: Record<string, unknown> | undefined): ChatActivity | null {
  const thumbnails = chatPhotos(data).map(photo => photo.thumbnail);
  return thumbnails.length ? { id, thumbnails } : null;
}
