"use client";

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import PhotoViewer from './PhotoViewer';
import { auth } from '../lib/firebase';
import type { ChatActivity } from '../lib/chat';

export default function ChatActivityPreview({ activity, select, messageId }: {
  activity: ChatActivity;
  select?: (thumbnail: string) => void;
  messageId?: string;
}) {
  const [gallery, setGallery] = useState<{ images: string[]; index: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), [messageId]);

  async function open(thumbnail: string) {
    const user = auth.currentUser;
    if (!messageId || !user || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ gallery: messageId, thumbnail });
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
    <div className="chat-photo-strip" aria-label="Fotky ze záznamu">
      {activity.thumbnails.map((url, index) => {
        const image = <Image src={url} width={96} height={96} unoptimized alt="" />;
        if (!select && !messageId) return <span key={url}>{image}</span>;
        return <button type="button" key={url} className="chat-photo-option"
          disabled={loading} aria-label={select ? `Vybrat fotku ${index + 1}` : `Otevřít fotku ${index + 1} v galerii záznamu`}
          onClick={() => select ? select(url) : void open(url)}>{image}</button>;
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
