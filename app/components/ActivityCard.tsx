"use client";
import UserAvatar from "./UserAvatar";

import RecordCard from "./RecordCard";
import OverlayDialog from "./OverlayDialog";
import { useEffect, useRef, useState } from "react";
import { ActivityCardHeading, ActivityCardStats } from "./ActivityCardContent";
import ActivityGallery from "./ActivityGallery";
import type { ActivityPoints } from "../lib/activityPoints";
import ActivityRunHeading from "./ActivityRunHeading";
import { auth } from "../lib/firebase";
import { Heart, MessageCircle, Pencil, Trash2, X, Send } from "lucide-react";
import { getPublicProfiles } from "../lib/services/publicProfiles";
import { showAppToast } from "./AppToast";

export type ActivityCardRun = {
  id: string; uid?: string; nickname?: string; email?: string; avatarUrl?: string;
  repetitions?:number; km: number | string; minuty: number | string; tempo: number | string;
  timestamp?: { seconds: number } | Date; imageUrl?: string; imageUrls?: string[]; teamId?: string;
  likedBy?: string[]; likeCount?: number; commentCount?: number; description?: string;
};
type SocialComment = { id: string; uid: string; nickname: string; avatarUrl?: string; text: string; createdAt?: string | null; mine?: boolean };
type SocialUser = { uid: string; nickname: string; avatarUrl?: string };
type Props = {
  levelScore?: ActivityPoints;
  run: ActivityCardRun; nickname?: string; avatarUrl?: string; teamName?: string | null; teamAvatarUrl?: string;
  activityType: string; onUserClick?: () => void; onPhotosClick: (images: string[], fallback: string, startIndex?: number) => void;
  onEdit?: () => void; onDelete?: () => void;
};

async function socialRequest(runId: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error("Pro sociální funkce se musíš přihlásit.");
  const token = await user.getIdToken();
  const response = await fetch(`/api/runs/social?runId=${encodeURIComponent(runId)}`, {
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

export default function ActivityCard({ run, nickname, avatarUrl, teamName, teamAvatarUrl, activityType, onUserClick, onPhotosClick, onEdit, onDelete, levelScore }: Props) {
  const date = run.timestamp instanceof Date ? run.timestamp : run.timestamp?.seconds ? new Date(run.timestamp.seconds * 1000) : null;
  const images = Array.isArray(run.imageUrls) && run.imageUrls.length ? run.imageUrls : run.imageUrl ? [run.imageUrl] : [];
  const [liked, setLiked] = useState(() => !!auth.currentUser?.uid && (run.likedBy || []).includes(auth.currentUser?.uid || ""));
  const [likeCount, setLikeCount] = useState(() => Number(run.likeCount) || run.likedBy?.length || 0);
  const [commentCount, setCommentCount] = useState(() => Number(run.commentCount) || 0);
  const [socialOpen, setSocialOpen] = useState<"likes" | "comments" | null>(null);
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [likeUsers, setLikeUsers] = useState<SocialUser[]>([]);
  const [likesTruncated, setLikesTruncated] = useState(false);
  const [commentsTruncated, setCommentsTruncated] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const likeLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const likeLongPressTriggered = useRef(false);
  const [socialError, setSocialError] = useState("");
  useEffect(() => { if (socialError) showAppToast(socialError, "error"); }, [socialError]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [resolvedNickname, setResolvedNickname] = useState(nickname || run.nickname || run.email?.split("@")[0] || "Uživatel");
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState(avatarUrl || run.avatarUrl || "");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  useEffect(() => {
    setResolvedNickname(nickname || run.nickname || run.email?.split("@")[0] || "Uživatel");
    setResolvedAvatarUrl(avatarUrl || run.avatarUrl || "");
  }, [nickname, avatarUrl, run.nickname, run.avatarUrl, run.email]);

  useEffect(() => {
    const uid = run.uid;
    if (!uid) return;
    let cancelled = false;
    function loadProfile(userId: string) {
      void getPublicProfiles([userId]).then(profiles => {
        if (cancelled) return;
        const profile = profiles[userId];
        if (profile?.nickname) setResolvedNickname(profile.nickname);
        if (profile) setResolvedAvatarUrl(profile.avatarUrl || "");
      }).catch(error => {
        console.warn("Nepodařilo se načíst veřejný profil aktivity", error);
      });
    }
    const element = cardRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      loadProfile(uid);
      return () => { cancelled = true; };
    }
    const observer = new IntersectionObserver(entries => {
      if (!cancelled && entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        loadProfile(uid);
      }
    }, { rootMargin: "160px" });
    observer.observe(element);
    return () => { cancelled = true; observer.disconnect(); };
  }, [run.uid]);

  useEffect(() => {
    const user = auth.currentUser;
    setLiked(!!user?.uid && (run.likedBy || []).includes(user.uid));
    setLikeCount(Number(run.likeCount) || run.likedBy?.length || 0);
    setCommentCount(Number(run.commentCount) || 0);
  }, [run.id, run.likeCount, run.commentCount, run.likedBy]);

  useEffect(() => {
    return () => {
      if (likeLongPressTimer.current) {
        clearTimeout(likeLongPressTimer.current);
        likeLongPressTimer.current = null;
      }
    };
  }, []);

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
      setLikesTruncated(result.likesTruncated === true);
      setCommentsTruncated(result.commentsTruncated === true);
      setIsAdmin(result.isAdmin === true);
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

  const startLikeLongPress = () => {
    likeLongPressTriggered.current = false;
    if (likeLongPressTimer.current) clearTimeout(likeLongPressTimer.current);
    likeLongPressTimer.current = setTimeout(() => {
      likeLongPressTriggered.current = true;
      void loadSocial("likes");
    }, 600);
  };

  const cancelLikeLongPress = () => {
    if (likeLongPressTimer.current) {
      clearTimeout(likeLongPressTimer.current);
      likeLongPressTimer.current = null;
    }
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

  const startEditComment = (comment: SocialComment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.text);
    setSocialError("");
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText("");
  };

  const saveEditComment = async () => {
    const text = editingCommentText.trim();
    if (!editingCommentId || !text || socialBusy) return;
    setSocialBusy(true);
    setSocialError("");
    try {
      const result = await socialRequest(run.id, {
        method: "POST",
        body: JSON.stringify({ runId: run.id, action: "comment_update", commentId: editingCommentId, text }),
      });
      if (result.comment) setComments(previous => previous.map(comment => comment.id === editingCommentId ? { ...comment, ...result.comment } : comment));
      cancelEditComment();
    } catch (error) {
      setSocialError(error instanceof Error ? error.message : "Komentář se nepodařilo upravit.");
    } finally { setSocialBusy(false); }
  };

  const deleteComment = async (commentId: string) => {
    if (socialBusy || !window.confirm("Opravdu chceš tento komentář smazat?")) return;
    setSocialBusy(true);
    setSocialError("");
    try {
      const result = await socialRequest(run.id, {
        method: "POST",
        body: JSON.stringify({ runId: run.id, action: "comment_delete", commentId }),
      });
      if (result.ok) {
        setComments(previous => previous.filter(comment => comment.id !== commentId));
        setCommentCount(previous => Math.max(0, previous - 1));
        if (editingCommentId === commentId) cancelEditComment();
      }
    } catch (error) {
      setSocialError(error instanceof Error ? error.message : "Komentář se nepodařilo smazat.");
    } finally { setSocialBusy(false); }
  };

  const formatCommentDate = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const heading = { nickname: resolvedNickname, avatarUrl: resolvedAvatarUrl, activityType, date,
    onUserClick, teamName, teamAvatarUrl };

  return (
    <>
      <RecordCard ref={cardRef} id={`run-${run.id}`}>
        {activityType === "běh" && run.uid
          ? <ActivityRunHeading key={run.uid} {...heading} uid={run.uid} recordId={run.id} score={levelScore}/>
          : <ActivityCardHeading {...heading}/>}
        <ActivityCardStats run={run} activityType={activityType}/>

        {images.length > 0 && <ActivityGallery key={run.id} images={images} onOpen={index => onPhotosClick(images, run.imageUrl || "", index)} />}

        <footer className="activity-card-actions activity-social-actions">
          <button
            type="button"
            className={`activity-social-button ${liked ? "is-liked" : ""} ${likeCount > 0 ? "has-likes" : ""}`}
            onClick={() => { if (!likeLongPressTriggered.current) void toggleLike(); likeLongPressTriggered.current = false; }}
            onPointerDown={startLikeLongPress}
            onPointerUp={cancelLikeLongPress}
            onPointerLeave={cancelLikeLongPress}
            onPointerCancel={cancelLikeLongPress}
            disabled={socialBusy}
            aria-label={liked ? `Zrušit To se mi líbí · ${likeCount}` : `To se mi líbí · ${likeCount}`}
            title="Dlouze podrž pro zobrazení, kdo lajknul"
          >
            <Heart size={20} fill={liked ? "currentColor" : "none"} /><span>{likeCount}</span>
          </button>
          <button type="button" className={`activity-social-button ${commentCount > 0 ? "has-comments" : ""}`} onClick={() => void loadSocial("comments")} aria-label={`Komentáře · ${commentCount}`}>
            <MessageCircle size={20} /><span>{commentCount}</span>
          </button>
          <span className="activity-actions-spacer" />
          {onEdit && <button type="button" className="activity-manage-button" onClick={onEdit} aria-label="Upravit záznam" title="Upravit záznam"><Pencil size={18} aria-hidden="true" /></button>}
          {onDelete && <button type="button" className="activity-manage-button activity-delete-button" onClick={onDelete} aria-label="Smazat záznam" title="Smazat záznam"><Trash2 size={18} aria-hidden="true" /></button>}
        </footer>
      </RecordCard>

      {socialOpen && (
        <OverlayDialog className="social-modal-backdrop" label={socialOpen === "likes" ? "To se mi líbí" : "Komentáře"} onDismiss={() => setSocialOpen(null)}>
          <section className="social-modal" onClick={event => event.stopPropagation()}>
            <header className="social-modal-header">
              <div><span className="social-modal-eyebrow">{socialOpen === "likes" ? "REAKCE" : "DISKUZE"}</span><h2>{socialOpen === "likes" ? `To se mi líbí · ${likeCount}` : `Komentáře · ${commentCount}`}</h2></div>
              <button type="button" className="social-modal-close" onClick={() => setSocialOpen(null)} aria-label="Zavřít"><X size={20}/></button>
            </header>

            {socialLoading ? <p className="social-modal-empty">Načítám…</p> : socialOpen === "likes" ? (
              likeUsers.length ? (
                <>
                  <div className="social-user-list">
                    {likeUsers.map(user => <button key={user.uid} type="button" className="social-user-row" onClick={() => routerSafeUser(user.uid)}><UserAvatar name={user.nickname} url={user.avatarUrl}/><strong>{user.nickname}</strong></button>)}
                  </div>
                  {likesTruncated && <p className="social-modal-note">Zobrazeno je prvních 100 reakcí.</p>}
                </>
              ) : <p className="social-modal-empty">Zatím nikdo nelajknul tento záznam.</p>
            ) : (
              <>
                <div className="social-comment-list">
                  {comments.length ? comments.map(comment => (
                    <article className="social-comment" key={comment.id}>
                      <UserAvatar name={comment.nickname} url={comment.avatarUrl}/>
                      <div className="social-comment-body">
                        <div className="social-comment-heading"><div className="social-comment-meta"><strong>{comment.nickname}</strong><time>{formatCommentDate(comment.createdAt)}</time></div>
                        {(comment.mine || isAdmin) && editingCommentId !== comment.id && <div className="social-comment-tools">
                          {comment.mine && <button type="button" className="social-comment-icon-button" onClick={() => startEditComment(comment)} disabled={socialBusy} aria-label="Upravit komentář" title="Upravit komentář"><Pencil size={15}/></button>}
                          <button type="button" className="social-comment-icon-button social-comment-delete-button" onClick={() => void deleteComment(comment.id)} disabled={socialBusy} aria-label="Smazat komentář" title="Smazat komentář"><Trash2 size={15}/></button>
                        </div>}
                        </div>
                        {editingCommentId === comment.id ? (
                          <div className="social-comment-edit">
                            <textarea aria-label="Upravit text komentáře" value={editingCommentText} maxLength={500} onChange={e => setEditingCommentText(e.target.value)} />
                            <div><button type="button" onClick={() => void saveEditComment()} disabled={!editingCommentText.trim() || socialBusy}>Uložit</button><button type="button" onClick={cancelEditComment} disabled={socialBusy}>Zrušit</button></div>
                          </div>
                        ) : <p>{comment.text}</p>}

                      </div>
                    </article>
                  )) : <p className="social-modal-empty">Zatím tu není žádný komentář.</p>}
                </div>
                {commentsTruncated && <p className="social-modal-note">Zobrazeno je prvních 100 komentářů.</p>}
                <div className="social-comment-form">
                  <textarea aria-label="Nový komentář" value={commentText} maxLength={500} placeholder="Napiš komentář…" onChange={e => setCommentText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submitComment(); } }} />
                  <button type="button" onClick={() => void submitComment()} disabled={!commentText.trim() || socialBusy} aria-label="Odeslat komentář"><Send size={18}/></button>
                </div>
              </>
            )}
          </section>
        </OverlayDialog>
      )}
    </>
  );
}

function routerSafeUser(uid: string) {
  window.location.href = "/user/" + uid;
}
