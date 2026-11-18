"use client";

import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import PhotoViewer from './PhotoViewer';
import { auth } from '../lib/firebase';
import { chatPreviewUrl, type ChatActivity } from '../lib/chat';

export default function ChatActivityPreview({ activities, select, selected, atLimit = false, messageId }: {
  activities: ChatActivity[];
  select?: (activityId: string, thumbnail: string) => void;
  selected?: (activityId: string, thumbnail: string) => boolean;
  atLimit?: boolean;
  messageId?: string;
}) {
  const [gallery, setGallery] = useState<{ images: string[]; index: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), [messageId]);

  async function open(activityId: string, thumbnail: string) {
    const user = auth.currentUser;
    if (!messageId || !user || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ gallery: messageId, activityId, thumbnail });
      const response = await fetch('/api/chat?' + params, {
        cache: 'no-store',
        signal: controller.signal,
        headers: { Authorization: 'Bearer ' + await user.getIdToken() },
      });
      if (!response.ok) throw new Error('Fotky ze záznamu už nejsou dostupné.');
      const data = await response.json();
      if (!controller.signal.aborted && auth.currentUser?.uid === user.uid) setGallery(data);
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Galerii se nepodařilo otevřít.');
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return <>
    <div className="chat-photo-strip" aria-label="Fotky ze záznamu" tabIndex={0}>
      {activities.flatMap(activity => activity.thumbnails.map(url => ({ activityId: activity.id, url })))
        .map(({ activityId, url }, index) => {
          const checked = selected?.(activityId, url) ?? false;
          const key = activityId + ':' + url;
          const image = <img src={chatPreviewUrl(url)} alt="" loading="lazy" decoding="async" />;
          if (!select && !messageId) return <span key={key} className="chat-photo-tile">{image}</span>;
          return <button type="button" key={key} className="chat-photo-tile chat-photo-option"
            disabled={loading || Boolean(select && atLimit && !checked)}
            aria-pressed={select ? checked : undefined}
            aria-label={select ? `Vybrat fotku ${index + 1}` : `Otevřít fotku ${index + 1} v galerii záznamu`}
            onClick={() => select ? select(activityId, url) : void open(activityId, url)}>
            {image}
            {select && <span className="chat-photo-check" aria-hidden="true">{checked && <Check size={18} />}</span>}
          </button>;
        })}
    </div>
    {loading && <span role="status">Otevírám galerii…</span>}
    {error && <span role="alert">{error}</span>}
    {gallery && <PhotoViewer url={gallery.images[gallery.index]} onClose={() => setGallery(null)}
      onMove={direction => setGallery(current => current && ({
        ...current,
        index: (current.index + direction + current.images.length) % current.images.length,
      }))}
      footer={<span>{gallery.index + 1} / {gallery.images.length}</span>} />}
  </>;
}
