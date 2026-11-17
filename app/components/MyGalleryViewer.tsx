"use client";
import { activityLabel, activityAmount, activityUnit } from "../lib/activity";
import type { GalleryPhoto } from "../lib/myGallery";
import PhotoViewer from "./PhotoViewer";
export default function MyGalleryViewer({photo,onClose,onMove,onOpenRun}:{photo:GalleryPhoto;onClose:()=>void;onMove:(direction:number)=>void;onOpenRun:()=>void}) {
  return <PhotoViewer url={photo.url} onClose={onClose} onMove={onMove} footer={<><div><strong>{photo.date?.toLocaleString("cs-CZ",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"})||"Datum neuvedeno"}</strong><span>{activityLabel(photo.type)} · {activityAmount(photo).toLocaleString("cs-CZ")} {activityUnit(photo.type)}</span></div><button type="button" className="tile-button" onClick={onOpenRun}>Otevřít záznam</button></>}/>;
}
