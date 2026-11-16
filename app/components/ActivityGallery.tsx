"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
  const [edges, setEdges] = useState({ previous: false, next: false });
  const updateEdges = useCallback(() => {
    const element = track.current;
    if (!element) return;
    const previous = element.scrollLeft > 2;
    const next = element.scrollWidth - element.clientWidth - element.scrollLeft > 2;
    setEdges(current => current.previous === previous && current.next === next ? current : { previous, next });
  }, []);
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const frame = window.requestAnimationFrame(updateEdges);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateEdges);
    observer?.observe(element);
    return () => { window.cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [images.length, updateEdges]);
  if (!images.length) return null;
  const move = (direction: number) => {
    const element = track.current;
    if (!element) return;
    const step = element.querySelector<HTMLElement>(".activity-gallery-thumb")?.offsetWidth || 132;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({ left: direction * (step + 8), behavior: reduced ? "auto" : "smooth" });
  };
  return <section className="activity-gallery" aria-label={`Fotografie aktivity, počet ${images.length}`}>
    <div className="activity-gallery-track" ref={track} onScroll={updateEdges} tabIndex={0} role="group" aria-label="Galerie fotografií, posouvej doleva nebo doprava">
      {images.map((url, index) => <Thumbnail key={url + index} url={url} index={index} count={images.length} onOpen={onOpen} />)}
    </div>
    {images.length > 1 && <>
      <button type="button" className="activity-gallery-arrow activity-gallery-prev" onClick={() => move(-1)} disabled={!edges.previous} aria-label="Posunout fotografie doleva"><ChevronLeft size={20} aria-hidden="true" /></button>
      <button type="button" className="activity-gallery-arrow activity-gallery-next" onClick={() => move(1)} disabled={!edges.next} aria-label="Posunout fotografie doprava"><ChevronRight size={20} aria-hidden="true" /></button>
    </>}
  </section>;
}
