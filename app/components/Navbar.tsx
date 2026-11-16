"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Flag, Heart, Home, Menu, MessageCircle, Settings, Users, X } from "lucide-react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { notificationTarget } from "../lib/notifications/target";
import { cloudinaryImageUrl } from "../lib/imageUrl";

type NavbarProps = {
  onMenuClick: () => void;
  onHomeClick?: () => void;
  showHome?: boolean;
  title?: string;
};

export default function Navbar({
  onMenuClick,
  onHomeClick,
  showHome = true,
  title = "Dolní Lhota v pohybu",
}: NavbarProps) {
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      const previousY = lastScrollY.current;
      const scrollingDown = currentY > previousY && currentY > 72;
      setVisible(!scrollingDown);
      lastScrollY.current = currentY;
    };

    lastScrollY.current = window.scrollY;
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`site-navbar ${visible ? "is-visible" : "is-hidden"}`}>
      <div className="site-navbar-inner">
        {showHome ? (
          <button type="button" className="site-navbar-button" onClick={onHomeClick} aria-label="Domů">
            <Home size={21} strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : (
          <span className="site-navbar-spacer" aria-hidden="true" />
        )}
        <div className="site-navbar-title" title={title}>{title}</div>
        <NotificationsBell />
        <button type="button" className="site-navbar-button" onClick={onMenuClick} aria-label="Otevřít navigaci">
          <Menu size={25} strokeWidth={2.1} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}


type AppNotification = {
  id: string; type: string; title: string; body: string; runId?: string; teamId?: string; challengeId?: string;
  actorNickname?: string; actorAvatarUrl?: string; read: boolean; createdAt?: string | null;
};

function NotificationsBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestVersion = useRef(0);
  const mutationBusy = useRef(false);
  const bellRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    const user = auth.currentUser;
    if (!user || mutationBusy.current) return;
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) throw new Error("Upozornění se nepodařilo načíst.");
      const data = await response.json();
      if (version !== requestVersion.current || auth.currentUser?.uid !== user.uid) return;
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(Number(data.unreadCount) || 0);
      setError("");
    } catch {
      if (version === requestVersion.current && auth.currentUser?.uid === user.uid) setError("Upozornění se nepodařilo načíst. Zkus to znovu.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const invalidate = () => { ++requestVersion.current; };
    const unsubscribe = onAuthStateChanged(auth, () => {
      ++requestVersion.current;
      setNotifications([]); setUnreadCount(0); setOpen(false); setError("");
      void load();
    });
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    const timer = setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      invalidate();
      unsubscribe(); clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  const close = () => { setOpen(false); bellRef.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); bellRef.current?.focus(); }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);

  const markRead = async (notification?: AppNotification) => {
    const user = auth.currentUser;
    if (!user || mutationBusy.current) return false;
    mutationBusy.current = true;
    ++requestVersion.current;
    setLoading(false); setBusy(true); setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(notification ? { notificationId: notification.id } : { markAll: true }),
      });
      if (!response.ok) throw new Error("Upozornění se nepodařilo označit. Zkus to znovu.");
      if (auth.currentUser?.uid !== user.uid) return false;
      setNotifications(previous => notification ? previous.filter(item => item.id !== notification.id) : []);
      setUnreadCount(previous => notification ? Math.max(0, previous - (notification.read ? 0 : 1)) : 0);
      return true;
    } catch {
      if (auth.currentUser?.uid === user.uid) setError("Upozornění se nepodařilo označit. Zkus to znovu.");
      return false;
    } finally {
      ++requestVersion.current;
      mutationBusy.current = false;
      setBusy(false);
    }
  };

  const openNotification = async (notification: AppNotification) => {
    if (!(await markRead(notification))) return;
    close();
    const target = notificationTarget(notification);
    if (target) router.push(target);
  };

  return <div className="notification-wrap">
    <button type="button" ref={bellRef} className="site-navbar-button notification-button" aria-expanded={open} aria-controls="notifications-panel" onClick={() => { setOpen(value => !value); void load(); }} aria-label={`Upozornění, ${unreadCount} nepřečtených`}>
      <Bell size={21} strokeWidth={2.2} aria-hidden="true" />
      {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    {open && <>
      <button type="button" className="notification-backdrop" aria-label="Zavřít upozornění" onClick={close} />
      <section id="notifications-panel" className="notification-panel" aria-label="Upozornění" aria-busy={busy || loading}>
        <header className="notification-panel-header"><div><strong>Upozornění</strong><small>{unreadCount ? `${unreadCount} nepřečtených` : "Všechno přečteno"}</small></div><button type="button" onClick={close} aria-label="Zavřít"><X size={18}/></button></header>
        {unreadCount > 0 && <button type="button" className="notification-mark-all" disabled={busy} onClick={() => void markRead()}>Označit vše jako přečtené</button>}
        {error && <div className="notification-error" role="alert">{error}<button type="button" disabled={busy || loading} onClick={() => void load()}>Zkusit znovu</button></div>}
        <div className="notification-list">
          {notifications.length ? notifications.map(notification => <button type="button" key={notification.id} className={`notification-item ${notification.read ? "" : "is-unread"}`} disabled={busy} onClick={() => void openNotification(notification)}>
            <span className="notification-avatar">{notification.actorAvatarUrl ? <img src={cloudinaryImageUrl(notification.actorAvatarUrl, 64)} alt="" /> : notification.teamId ? <Users size={18} /> : notification.challengeId ? <Flag size={18} /> : notification.type === "social_like" ? <Heart size={18} /> : <MessageCircle size={18} />}</span>
            <span className="notification-copy"><strong>{notification.title}</strong><span>{notification.body}</span>{notification.createdAt && <time>{new Date(notification.createdAt).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</time>}</span>
            {!notification.read && <i aria-hidden="true" />}
          </button>) : <p className="notification-empty">{loading ? "Načítám upozornění…" : error ? "" : "Zatím žádná upozornění."}</p>}
        </div>
        <button type="button" className="notification-settings" onClick={() => { close(); router.push("/settings#notifications"); }}><Settings size={16} /> Nastavení upozornění</button>
      </section>
    </>}
  </div>;
}
