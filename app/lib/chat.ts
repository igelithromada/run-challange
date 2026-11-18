import { activityThumbnailUrl } from './imageUrl';

export const CHAT_CHANGED = 'dolni-lhota:chat-changed';
export const MAX_CHAT_PHOTOS = 6;
export type ChatPhotoSelection = { activityId: string; thumbnail: string };
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
    if (photos.size === MAX_CHAT_PHOTOS) break;
  }
  return Array.from(photos, ([thumbnail, url]) => ({ thumbnail, url }));
}

export function chatActivity(id: string, data: Record<string, unknown> | undefined): ChatActivity | null {
  const thumbnails = chatPhotos(data).map(photo => photo.thumbnail);
  return thumbnails.length ? { id, thumbnails } : null;
}


// Keep existing attachment IDs stable and use the same display variant as activity cards.
export function chatPreviewUrl(thumbnail: string) {
  return thumbnail.replace('/f_auto,q_auto:eco,c_limit,w_192,h_192/', '/f_auto,q_auto:eco,c_limit,w_640,h_720/');
}

export function groupChatPhotos(photos: ChatPhotoSelection[]): ChatActivity[] {
  const groups = new Map<string, ChatActivity>();
  for (const { activityId, thumbnail } of photos) {
    if (!groups.has(activityId)) groups.set(activityId, { id: activityId, thumbnails: [] });
    groups.get(activityId)!.thumbnails.push(thumbnail);
  }
  return Array.from(groups.values());
}
