"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { activityThumbnailUrl } from "../lib/imageUrl";

function Thumbnail({ url, index, count, onOpen }: { url: string; index: number; count: number; onOpen: (index: number) => void }) {
  const [failed, setFailed] = useState(false);
  const thumbnail = activityThumbnailUrl(url);
  return <button type="button" className="activity-gallery-thumb" onClick={() => onOpen(index)} aria-label={`Otevřít fotografii ${index + 1} z ${count}`}>
    {thumbnail && !failed
      ? <img src={thumbnail} alt="" loading="lazy" decoding="async" fetchPriority="low" draggable={false} onError={() => setFailed(true)} />
      : <span className="activity-gallery-placeholder"><Camera size={23} aria-hidden="true" /><small>Zobrazit fotografii</small></span>}
  </button>;
}

export default function ActivityGallery({ images, onOpen }: { images: string[]; onOpen: (index: number) => void }) {
  if (!images.length) return null;
  return <section className="activity-gallery" aria-label={`Fotografie aktivity, počet ${images.length}`}>
    <div className="activity-gallery-track" tabIndex={0} role="group" aria-label="Galerie fotografií, posouvej doleva nebo doprava">
      {images.map((url, index) => <Thumbnail key={url + index} url={url} index={index} count={images.length} onOpen={onOpen} />)}
    </div>
  </section>;
}
