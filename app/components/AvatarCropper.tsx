"use client";
import { useEffect, useRef, useState } from "react";
import { avatarCrop } from "../lib/avatarCrop";

type Props = { file: File; busy: boolean; onCancel: () => void; onSave: (file: File) => Promise<void> };
export default function AvatarCropper({ file, busy, onCancel, onSave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null), image = useRef<HTMLImageElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const [url, setUrl] = useState(""), [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const saving = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const working = busy || preparing;
  const [zoom, setZoom] = useState(1), [x, setX] = useState(0), [y, setY] = useState(0), [error, setError] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file); setUrl(objectUrl); dialog.current?.showModal();
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { URL.revokeObjectURL(objectUrl); document.body.style.overflow = previous; };
  }, [file]);
  const crop = dimensions ? avatarCrop(dimensions.width, dimensions.height, zoom, x, y) : null;
  const save = async () => {
    if (!crop || !image.current || saving.current || busy) return;
    saving.current = true; setPreparing(true); setError("");
    try {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 768;
      const context = canvas.getContext("2d"); if (!context) throw new Error("Fotografii se nepodařilo připravit.");
      context.fillStyle = "#fff"; context.fillRect(0, 0, 768, 768);
      context.drawImage(image.current, crop.sx, crop.sy, crop.size, crop.size, 0, 0, 768, 768);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Fotografii se nepodařilo připravit.")), "image/jpeg", .88));
      await onSave(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Fotografii se nepodařilo připravit."); }
    finally { saving.current = false; setPreparing(false); }
  };
  return <dialog ref={dialog} className="avatar-crop-dialog" aria-labelledby="avatar-crop-title" onCancel={event => { event.preventDefault(); if (!working) onCancel(); }}>
    <h2 id="avatar-crop-title">Uprav profilovou fotku</h2>
    <p>Posuň fotku prstem a přibliž ji. V kruhu vidíš výsledný avatar.</p>
    <div className="avatar-crop-frame" onPointerDown={event => { if (!crop || working) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { px: event.clientX, py: event.clientY, x, y }; }} onPointerMove={event => {
      if (!drag.current || !crop || working) return;
      const maxX = (crop.displayWidth - 260) / 2, maxY = (crop.displayHeight - 260) / 2;
      if (maxX > 0) setX(Math.max(-100, Math.min(100, drag.current.x + (event.clientX - drag.current.px) / maxX * 100)));
      if (maxY > 0) setY(Math.max(-100, Math.min(100, drag.current.y + (event.clientY - drag.current.py) / maxY * 100)));
    }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      {url && <img ref={image} src={url} alt="Náhled výřezu profilové fotografie" draggable={false} onLoad={event => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => setError("Fotografii se nepodařilo načíst. Zkus jinou.")} style={crop ? { width: crop.displayWidth, height: crop.displayHeight, transform: `translate(-50%, -50%) translate(${crop.offsetX}px, ${crop.offsetY}px)` } : { visibility: "hidden" }} />}
    </div>
    <div className="avatar-crop-controls">
      <label>Přiblížení<input type="range" min="1" max="3" step="0.01" value={zoom} disabled={working} onChange={e => setZoom(Number(e.target.value))} /></label>
      <label>Posun vodorovně<input type="range" min="-100" max="100" value={x} disabled={working || !crop || crop.displayWidth <= 260.01} onChange={e => setX(Number(e.target.value))} /></label>
      <label>Posun svisle<input type="range" min="-100" max="100" value={y} disabled={working || !crop || crop.displayHeight <= 260.01} onChange={e => setY(Number(e.target.value))} /></label>
    </div>
    {error && <p role="alert">{error}</p>}
    <div className="avatar-crop-actions"><button type="button" className="tile-button" disabled={working} onClick={onCancel}>Zrušit</button><button type="button" className="tile-button" disabled={working || !crop || !!error} onClick={() => void save()}>{working ? "Ukládám…" : "Uložit fotografii"}</button></div>
  </dialog>;
}
