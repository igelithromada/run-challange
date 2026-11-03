"use client";
import React from "react";

export type ActivityCardRun = {
  id: string;
  uid?: string;
  nickname?: string;
  email?: string;
  km: number | string;
  minuty: number | string;
  tempo: number | string;
  timestamp?: { seconds: number };
  imageUrl?: string;
  imageUrls?: string[];
  teamId?: string;
};

type Props = {
  run: ActivityCardRun;
  nickname: string;
  avatarUrl?: string;
  teamName?: string | null;
  activityType: string;
  onUserClick?: () => void;
  onPhotosClick: (images: string[], fallback: string) => void;
};

const formatTime = (value: number | string) => {
  const totalSeconds = Math.round(Number(value) * 60);
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${min}′${sec.toString().padStart(2, "0")}″`;
};

export default function ActivityCard({ run, nickname, avatarUrl, teamName, activityType, onUserClick, onPhotosClick }: Props) {
  const tempo = Number(run.tempo) || 0;
  const range = activityType === "chůze" ? { min: 8, max: 20 } : { min: 3, max: 8 };
  const pos = Math.min(100, Math.max(0, ((range.max - tempo) / (range.max - range.min)) * 100));
  const date = run.timestamp?.seconds ? new Date(run.timestamp.seconds * 1000) : null;
  const images = Array.isArray(run.imageUrls) && run.imageUrls.length ? run.imageUrls : run.imageUrl ? [run.imageUrl] : [];

  return (
    <article className="tile list-tile activity-card">
      <div className="avatar">
        {avatarUrl ? <img src={avatarUrl} alt={`Avatar uživatele ${nickname}`} /> : nickname.charAt(0).toUpperCase()}
      </div>
      <div className="run-meta">
        {date && <small>{date.toLocaleString("cs-CZ", { hour: "2-digit", minute: "2-digit", year: "numeric", month: "numeric", day: "numeric" })}</small>}
        {images.length > 0 && (
          <button type="button" className="run-photo-icon" onClick={() => onPhotosClick(images, run.imageUrl || "")} aria-label="Zobrazit fotografie">
            <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M23 19V5a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2z" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </button>
        )}
      </div>
      <div className="run-info">
        <div className="run-heading">
          <span onClick={onUserClick} onKeyDown={(e) => e.key === "Enter" && onUserClick?.()} role={onUserClick ? "link" : undefined} tabIndex={onUserClick ? 0 : undefined} style={{ fontWeight: "bold", color: "white", cursor: onUserClick ? "pointer" : "default" }}>{nickname}</span>
          {teamName && <span className="activity-team-name">({teamName})</span>}
        </div>
        <div className="run-stats">
          <div className="run-distance">{run.km} km, {formatTime(run.minuty)}</div>
          <div className="run-pace">
            <div className="run-pace-label">{formatTime(run.tempo)} /km</div>
            <div className="activity-pace-bar">
              <div className="activity-pace-marker" style={{ left: `${pos}%` }} />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
