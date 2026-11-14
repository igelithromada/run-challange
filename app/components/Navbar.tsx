"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bell, Home, Menu, X } from "lucide-react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
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
  id: string; type: string; title: string; body: string; runId?: string;
  actorNickname?: string; actorAvatarUrl?: string; read: boolean; createdAt?: string | null;
};

function NotificationsBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const user = auth.currentUser;
    if (!user) { setNotifications([]); setUnreadCount(0); return; }
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(Number(data.unreadCount) || 0);
    } catch {}
  };

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) {
        void load();
        timer = setInterval(() => void load(), 20000);
      } else {
        if (timer) clearInterval(timer);
        timer = null;
        setNotifications([]); setUnreadCount(0); setOpen(false);
      }
    });
    return () => { unsubscribe(); if (timer) clearInterval(timer); };
  }, []);

  const markRead = async (notification: AppNotification) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notificationId: notification.id }),
      });
      setNotifications(previous => previous.filter(item => item.id !== notification.id));
      setUnreadCount(previous => Math.max(0, previous - (notification.read ? 0 : 1)));
    } catch {}
  };

  const markAllRead = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      await fetch("/api/notifications", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications([]);
      setUnreadCount(0);
    } catch {}
  };

  const openNotification = async (notification: AppNotification) => {
    await markRead(notification);
    setOpen(false);
    if (notification.runId) window.location.href = `/#run-${notification.runId}`;
  };

  if (unreadCount <= 0 && !open) return null;

  return <div className="notification-wrap">
    <button type="button" className="site-navbar-button notification-button" onClick={() => { setOpen(value => !value); void load(); }} aria-label={`Upozornění, ${unreadCount} nepřečtených`}>
      <Bell size={21} strokeWidth={2.2} aria-hidden="true" />
      {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    {open && <>
      <button type="button" className="notification-backdrop" aria-label="Zavřít upozornění" onClick={() => setOpen(false)} />
      <section className="notification-panel" aria-label="Upozornění">
        <header className="notification-panel-header"><div><strong>Upozornění</strong><small>{unreadCount ? `${unreadCount} nepřečtených` : "Všechno přečteno"}</small></div><button type="button" onClick={() => setOpen(false)} aria-label="Zavřít"><X size={18}/></button></header>
        {unreadCount > 0 && <button type="button" className="notification-mark-all" onClick={() => void markAllRead()}>Označit vše jako přečtené</button>}
        <div className="notification-list">
          {notifications.length ? notifications.map(notification => <button type="button" key={notification.id} className={`notification-item ${notification.read ? "" : "is-unread"}`} onClick={() => void openNotification(notification)}>
            <span className="notification-avatar">{notification.actorAvatarUrl ? <img src={cloudinaryImageUrl(notification.actorAvatarUrl, 64)} alt="" /> : (notification.actorNickname || "U").charAt(0).toUpperCase()}</span>
            <span className="notification-copy"><strong>{notification.title}</strong><span>{notification.body}</span>{notification.createdAt && <time>{new Date(notification.createdAt).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</time>}</span>
            {!notification.read && <i aria-hidden="true" />}
          </button>) : <p className="notification-empty">Zatím žádná upozornění.</p>}
        </div>
      </section>
    </>}
  </div>;
}
