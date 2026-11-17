"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { GalleryPhoto } from "../lib/myGallery";
import { cloudinaryImageUrl } from "../lib/imageUrl";
export default function MyGalleryViewer({
  photo,
  onClose,
  onMove,
  onOpenRun,
}: {
  photo: GalleryPhoto;
  onClose: () => void;
  onMove: (direction: number) => void;
  onOpenRun: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    start = useRef<{ id: number; x: number; y: number } | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="my-gallery-viewer"
      aria-label="Fotografie mé aktivity"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          onMove(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}
    >
      <button
        type="button"
        className="my-gallery-close"
        onClick={onClose}
        aria-label="Zavřít fotografii"
      >
        <X size={24} />
      </button>
      <div
        className="my-gallery-viewer-image"
        onPointerDown={(event) => {
          if (!event.isPrimary) { start.current = null; return; }
          if (event.isPrimary) {
            event.currentTarget.setPointerCapture(event.pointerId);
            start.current = {
              id: event.pointerId,
              x: event.clientX,
              y: event.clientY,
            };
          }
        }}
        onPointerUp={(event) => {
          const first = start.current;
          start.current = null;
          if (!first || first.id !== event.pointerId) return;
          const dx = event.clientX - first.x,
            dy = event.clientY - first.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5)
            onMove(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          start.current = null;
        }}
      >
        <img
          key={photo.key}
          src={cloudinaryImageUrl(photo.url, 1600)}
          alt={
            photo.date
              ? `Fotografie z aktivity ${photo.date.toLocaleDateString("cs-CZ")}`
              : "Fotografie z mé aktivity"
          }
          draggable={false}
        />
      </div>
      <footer>
        <div>
          <strong>
            {photo.date?.toLocaleString("cs-CZ", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }) || "Datum neuvedeno"}
          </strong>
          <span>
            {photo.type === "běh" ? "Běh" : "Chůze"} ·{" "}
            {photo.km.toLocaleString("cs-CZ")} km
          </span>
          <small>Mezi fotkami přejeď prstem doleva nebo doprava.</small>
        </div>
        <button type="button" className="tile-button" onClick={onOpenRun}>
          Otevřít záznam
        </button>
      </footer>
    </dialog>
  );
}
