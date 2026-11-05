"use client";

import React, { useEffect, useState } from "react";
import { auth } from "../lib/firebase";
import { Camera, Clock3, Gauge, Heart, MapPin, MessageCircle, Pencil, Trash2, X, Send, Users } from "lucide-react";
import { cloudinaryImageUrl } from "../lib/imageUrl";

export type ActivityCardRun = {
  id: string; uid?: string; nickname?: string; email?: string;
  km: number | string; minuty: number | string; tempo: number | string;
  timestamp?: { seconds: number } | Date; imageUrl?: string; imageUrls?: string[]; teamId?: string;
  likedBy?: string[]; likeCount?: number; commentCount?: number;
};
type SocialComment = { id: string; uid: string; nickname: string; avatarUrl?: string; text: string; createdAt?: string | null; mine?: boolean };
type SocialUser = { uid: string; nickname: string; avatarUrl?: string };
type Props = {
  run: ActivityCardRun; nickname: string; avatarUrl?: string; teamName?: string | null;
  activityType: string; onUserClick?: () => void; onPhotosClick: (images: string[], fallback: string) => void;
  onEdit?: () => void; onDelete?: () => void;
};

const formatTime = (value: number | string) => {
  const totalSeconds = Math.max(0, Math.round(Number(value) * 60));
  return `${Math.floor(totalSeconds / 60)}′${(totalSeconds % 60).toString().padStart(2, "0")}″`;
};

async function socialRequest(runId: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error("Pro sociální funkce se musíš přihlásit.");
  const token = await user.getIdToken();
  const response = await fetch("/api/runs/social", {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Operaci se nepodařilo provést.");
  return result;
}

export default function ActivityCard({ run, nickname, avatarUrl, teamName, activityType, onUserClick, onPhotosClick, onEdit, onDelete }: Props) {
  const tempo = Number(run.tempo) || 0;
  const range = activityType === "chůze" ? { min: 8, max: 20 } : { min: 3, max: 8 };
  const pos = Math.min(100, Math.max(0, ((range.max - tempo) / (range.max - range.min)) * 100));
  const date = run.timestamp instanceof Date ? run.timestamp : run.timestamp?.seconds ? new Date(run.timestamp.seconds * 1000) : null;
  const images = Array.isArray(run.imageUrls) && run.imageUrls.length ? run.imageUrls : run.imageUrl ? [run.imageUrl] : [];
  const [liked, setLiked] = useState(() => !!auth.currentUser?.uid && (run.likedBy || []).includes(auth.currentUser?.uid || ""));
  const [likeCount, setLikeCount] = useState(() => Number(run.likeCount) || run.likedBy?.length || 0);
  const [commentCount, setCommentCount] = useState(() => Number(run.commentCount) || 0);
  const [socialOpen, setSocialOpen] = useState<"likes" | "comments" | null>(null);
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [likeUsers, setLikeUsers] = useState<SocialUser[]>([]);
  const [commentText, setCommentText] = useState("");
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const [socialError, setSocialError] = useState("");

  useEffect(() => {
    const user = auth.currentUser;
    setLiked(!!user?.uid && (run.likedBy || []).includes(user.uid));
    setLikeCount(Number(run.likeCount) || run.likedBy?.length || 0);
    setCommentCount(Number(run.commentCount) || 0);
  }, [run.id, run.likeCount, run.commentCount, run.likedBy]);

  const loadSocial = async (mode: "likes" | "comments") => {
    setSocialOpen(mode);
    setSocialLoading(true);
    setSocialError("");
    try {
      const result = await socialRequest(run.id);
      setLiked(!!result.liked);
      setLikeCount(Number(result.likeCount) || 0);
      setCommentCount(Number(result.commentCount) || 0);
      setLikeUsers(Array.isArray(result.likes) ? result.likes : []);
      setComments(Array.isArray(result.comments) ? result.comments : []);
    } catch (error) {
      setSocialError(error instanceof Error ? error.message : "Data se nepodařilo načíst.");
    } finally { setSocialLoading(false); }
  };

  const toggleLike = async () => {
    if (socialBusy) return;
    setSocialBusy(true);
    setSocialError("");
    const previousLiked = liked;
    const previousCount = likeCount;
    setLiked(!previousLiked);
    setLikeCount(Math.max(0, previousCount + (previousLiked ? -1 : 1)));
    try {
      const result = await socialRequest(run.id, {
        method: "POST",
        body: JSON.stringify({ runId: run.id, action: "like" }),
      });
      setLiked(!!result.liked);
      setLikeCount(Number(result.likeCount) || 0);
    } catch (error) {
      setLiked(previousLiked);
      setLikeCount(previousCount);
      setSocialError(error instanceof Error ? error.message : "To se nepodařilo.");
    } finally { setSocialBusy(false); }
  };

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text || socialBusy) return;
    setSocialBusy(true);
    setSocialError("");
    try {
      const result = await socialRequest(run.id, {
        method: "POST",
        body: JSON.stringify({ runId: run.id, action: "comment", text }),
      });
      if (result.comment) setComments(previous => [...previous, result.comment]);
      setCommentText("");
      setCommentCount(previous => previous + 1);
    } catch (error) {
      setSocialError(error instanceof Error ? error.message : "Komentář se nepodařilo přidat.");
    } finally { setSocialBusy(false); }
  };

  const formatCommentDate = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <article className="tile list-tile activity-card activity-card-modern">
        <header className="activity-card-top">
          <button type="button" className="activity-avatar" onClick={onUserClick} disabled={!onUserClick} aria-label={`Profil uživatele ${nickname}`}>
            {avatarUrl ? <img src={cloudinaryImageUrl(avatarUrl, 128)} alt="" loading="lazy" decoding="async" /> : nickname.charAt(0).toUpperCase()}
          </button>
          <div className="activity-person">
            <span onClick={onUserClick} onKeyDown={e => e.key === "Enter" && onUserClick?.()} role={onUserClick ? "link" : undefined} tabIndex={onUserClick ? 0 : undefined}>{nickname}</span>
            {teamName && <small><b>Tým</b> · {teamName}</small>}
          </div>
          {date && <time className="activity-date" dateTime={date.toISOString()}>{date.toLocaleString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time>}
        </header>

        <div className="activity-metrics">
          <div><MapPin size={17} /><strong>{run.km} <small>km</small></strong><span>Vzdálenost</span></div>
          <div><Clock3 size={17} /><strong>{formatTime(run.minuty)}</strong><span>Čas</span></div>
          <div><Gauge size={17} /><strong>{formatTime(run.tempo)} <small>/km</small></strong><span>Tempo</span><div className="activity-pace-bar" aria-label="Orientační škála tempa"><span style={{ left: `${pos}%` }} /></div></div>
        </div>

        <footer className="activity-card-actions activity-social-actions">
          <button type="button" className={`activity-social-button ${liked ? "is-liked" : ""}`} onClick={() => void toggleLike()} disabled={socialBusy} aria-label={liked ? "Zrušit To se mi líbí" : "To se mi líbí"}>
            <Heart size={17} fill={liked ? "currentColor" : "none"} /> <span>{likeCount}</span>
          </button>
          <button type="button" className="activity-social-button" onClick={() => void loadSocial("likes")} aria-label="Zobrazit, kdo dal To se mi líbí">
            <Users size={16} /> Kdo lajkuje
          </button>
          <button type="button" className="activity-social-button" onClick={() => void loadSocial("comments")} aria-label="Zobrazit komentáře">
            <MessageCircle size={17} /> <span>{commentCount}</span> komentáře
          </button>
          <span className="activity-actions-spacer" />
          {images.length > 0 && <button type="button" className="activity-photos-button" onClick={() => onPhotosClick(images, run.imageUrl || "")}><Camera size={16} /> Fotografie ({images.length})</button>}
          {onEdit && <button type="button" className="activity-manage-button" onClick={onEdit}><Pencil size={15} /> Upravit</button>}
          {onDelete && <button type="button" className="activity-manage-button activity-delete-button" onClick={onDelete}><Trash2 size={15} /> Smazat</button>}
        </footer>
      </article>

      {socialOpen && (
        <div className="social-modal-backdrop" role="dialog" aria-modal="true" onClick={() => setSocialOpen(null)}>
          <section className="social-modal" onClick={event => event.stopPropagation()}>
            <header className="social-modal-header">
              <div><span className="social-modal-eyebrow">{socialOpen === "likes" ? "REAKCE" : "DISKUZE"}</span><h2>{socialOpen === "likes" ? `To se mi líbí · ${likeCount}` : `Komentáře · ${commentCount}`}</h2></div>
              <button type="button" className="social-modal-close" onClick={() => setSocialOpen(null)} aria-label="Zavřít"><X size={20}/></button>
            </header>

            {socialLoading ? <p className="social-modal-empty">Načítám…</p> : socialError ? <p className="form-message form-message-error">{socialError}</p> : socialOpen === "likes" ? (
              likeUsers.length ? (
                <div className="social-user-list">
                  {likeUsers.map(user => <button key={user.uid} type="button" className="social-user-row" onClick={() => routerSafeUser(user.uid, onUserClick)}><span className="activity-avatar">{user.avatarUrl ? <img src={cloudinaryImageUrl(user.avatarUrl, 64)} alt="" /> : user.nickname.charAt(0).toUpperCase()}</span><strong>{user.nickname}</strong></button>)}
                </div>
              ) : <p className="social-modal-empty">Zatím nikdo nelajknul tento záznam.</p>
            ) : (
              <>
                <div className="social-comment-list">
                  {comments.length ? comments.map(comment => (
                    <article className="social-comment" key={comment.id}>
                      <div className="activity-avatar">{comment.avatarUrl ? <img src={cloudinaryImageUrl(comment.avatarUrl, 64)} alt="" /> : comment.nickname.charAt(0).toUpperCase()}</div>
                      <div><div className="social-comment-meta"><strong>{comment.nickname}</strong><time>{formatCommentDate(comment.createdAt)}</time></div><p>{comment.text}</p></div>
                    </article>
                  )) : <p className="social-modal-empty">Zatím tu není žádný komentář.</p>}
                </div>
                <div className="social-comment-form">
                  <textarea value={commentText} maxLength={500} placeholder="Napiš komentář…" onChange={e => setCommentText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submitComment(); } }} />
                  <button type="button" onClick={() => void submitComment()} disabled={!commentText.trim() || socialBusy} aria-label="Odeslat komentář"><Send size={18}/></button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function routerSafeUser(uid: string, onUserClick?: () => void) {
  if (uid === auth.currentUser?.uid) {
    onUserClick?.();
    return;
  }
  window.location.href = "/user/" + uid;
}
