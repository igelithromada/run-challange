"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import { cloudinaryImageUrl } from "../lib/imageUrl";

export default function UserAvatar({ name, url, className = "", onClick }: {
  name: string;
  url?: string;
  className?: string;
  onClick?: () => void;
}) {
  const [failedUrl, setFailedUrl] = useState("");
  const src = cloudinaryImageUrl(url, 128);
  const hasPhoto = Boolean(src && src !== failedUrl);
  const status = hasPhoto ? "Profilová fotografie" : "Bez profilové fotografie";
  const content = hasPhoto
    ? <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailedUrl(src || "")}/>
    : <UserRound size="55%" aria-hidden="true"/>;
  const classes = `activity-avatar user-avatar ${className}`.trim();

  return onClick
    ? <button type="button" className={classes} onClick={onClick} aria-label={`Profil uživatele ${name}. ${status}`} title={status}>{content}</button>
    : <span className={classes} role="img" aria-label={status} title={status}>{content}</span>;
}
