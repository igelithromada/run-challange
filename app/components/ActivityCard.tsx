"use client";
import React from "react";
import { Camera, Clock3, Gauge, MapPin, Pencil, Trash2 } from "lucide-react";
import { cloudinaryImageUrl } from "../lib/imageUrl";

export type ActivityCardRun = {
  id: string; uid?: string; nickname?: string; email?: string;
  km: number | string; minuty: number | string; tempo: number | string;
  timestamp?: { seconds: number } | Date; imageUrl?: string; imageUrls?: string[]; teamId?: string;
};
type Props = {
  run: ActivityCardRun; nickname: string; avatarUrl?: string; teamName?: string | null;
  activityType: string; onUserClick?: () => void; onPhotosClick: (images: string[], fallback: string) => void;
  onEdit?: () => void; onDelete?: () => void;
};
const formatTime = (value: number | string) => {
  const totalSeconds = Math.max(0, Math.round(Number(value) * 60));
  return `${Math.floor(totalSeconds / 60)}′${(totalSeconds % 60).toString().padStart(2, "0")}″`;
};
export default function ActivityCard({ run, nickname, avatarUrl, teamName, activityType, onUserClick, onPhotosClick, onEdit, onDelete }: Props) {
  const tempo = Number(run.tempo) || 0;
  const range = activityType === "chůze" ? { min: 8, max: 20 } : { min: 3, max: 8 };
  const pos = Math.min(100, Math.max(0, ((range.max - tempo) / (range.max - range.min)) * 100));
  const date = run.timestamp instanceof Date ? run.timestamp : run.timestamp?.seconds ? new Date(run.timestamp.seconds * 1000) : null;
  const images = Array.isArray(run.imageUrls) && run.imageUrls.length ? run.imageUrls : run.imageUrl ? [run.imageUrl] : [];
  return (
    <article className="tile list-tile activity-card activity-card-modern">
      <button type="button" className="activity-avatar" onClick={onUserClick} disabled={!onUserClick} aria-label={`Profil uživatele ${nickname}`}>
        {avatarUrl ? <img src={cloudinaryImageUrl(avatarUrl, 128)} alt="" loading="lazy" decoding="async" /> : nickname.charAt(0).toUpperCase()}
      </button>
      <div className="activity-main">
        <div className="activity-card-heading">
          <div className="activity-person">
            <span onClick={onUserClick} onKeyDown={e => e.key === "Enter" && onUserClick?.()} role={onUserClick ? "link" : undefined} tabIndex={onUserClick ? 0 : undefined}>{nickname}</span>
            {teamName && <small>{teamName}</small>}
          </div>
          {date && <time dateTime={date.toISOString()}>{date.toLocaleString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time>}
        </div>
        <div className="activity-metrics">
          <div><MapPin size={16} /><strong>{run.km} km</strong><small>Vzdálenost</small></div>
          <div><Clock3 size={16} /><strong>{formatTime(run.minuty)}</strong><small>Čas</small></div>
          <div><Gauge size={16} /><strong>{formatTime(run.tempo)} /km</strong><small>Tempo</small></div>
        </div>
        <div className="activity-pace-track"><span style={{ width: `${pos}%` }} /></div>
        <div className="activity-card-actions">
          {images.length > 0 && <button type="button" className="activity-photos-button" onClick={() => onPhotosClick(images, run.imageUrl || "")}><Camera size={16} /> Fotografie ({images.length})</button>}
          {onEdit && <button type="button" className="activity-manage-button" onClick={onEdit}><Pencil size={15} /> Upravit</button>}
          {onDelete && <button type="button" className="activity-manage-button activity-delete-button" onClick={onDelete}><Trash2 size={15} /> Smazat</button>}
        </div>
      </div>
    </article>
  );
}
