"use client";

import React, { useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { activityThumbnailUrl } from "../lib/imageUrl";

function Thumbnail({ url, index, count, onOpen }: { url: string; index: number; count: number; onOpen: (index: number) => void }) {
  const [failed, setFailed] = useState(false);
  const thumbnail = activityThumbnailUrl(url);
  return <button type="button" className="activity-gallery-thumb" onClick={() => onOpen(index)} aria-label={`Otevřít fotografii ${index + 1} z ${count}`}>
    {thumbnail && !failed
      ? <img src={thumbnail} width={240} height={160} alt="" loading="lazy" decoding="async" fetchPriority="low" draggable={false} onError={() => setFailed(true)} />
      : <span className="activity-gallery-placeholder"><Camera size={23} aria-hidden="true" /><small>Zobrazit fotografii</small></span>}
    {count > 1 && <span className="activity-gallery-number" aria-hidden="true">{index + 1} / {count}</span>}
  </button>;
}

export default function ActivityGallery({ images, onOpen }: { images: string[]; onOpen: (index: number) => void }) {
  const track = useRef<HTMLDivElement>(null);
  if (!images.length) return null;
  const move = (direction: number) => {
    const element = track.current;
    if (!element) return;
    const step = element.querySelector<HTMLElement>(".activity-gallery-thumb")?.offsetWidth || 132;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({ left: direction * (step + 8), behavior: reduced ? "auto" : "smooth" });
  };
  return <section className="activity-gallery" aria-label={`Fotografie aktivity, počet ${images.length}`}>
    <div className="activity-gallery-track" ref={track} tabIndex={0} role="group" aria-label="Galerie fotografií, posouvej doleva nebo doprava">
      {images.map((url, index) => <Thumbnail key={url + index} url={url} index={index} count={images.length} onOpen={onOpen} />)}
    </div>
    {images.length > 1 && <>
      <button type="button" className="activity-gallery-arrow activity-gallery-prev" onClick={() => move(-1)} aria-label="Posunout fotografie doleva"><ChevronLeft size={20} aria-hidden="true" /></button>
      <button type="button" className="activity-gallery-arrow activity-gallery-next" onClick={() => move(1)} aria-label="Posunout fotografie doprava"><ChevronRight size={20} aria-hidden="true" /></button>
    </>}
  </section>;
}
