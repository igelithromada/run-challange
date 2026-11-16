"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserRound, X } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { getUserProfile } from "../lib/services/users";
import { NAVIGATION_GROUPS, NAVIGATION_ITEMS } from "../lib/navigation";
import { usePathname, useRouter } from "next/navigation";

type SidebarProps = { visible: boolean; onClose: () => void; onSelect: (item: string) => void };

export default function Sidebar({ visible, onClose, onSelect }: SidebarProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  const handleNavigation = (id: string) => {
    const item = NAVIGATION_ITEMS.find(entry => entry.id === id);
    if (!item || (item.adminOnly && !isAdmin)) return;
    onClose();
    if (item.id === "routes" || item.id === "challenges") {
      router.push(item.route);
      return;
    }
    onSelect(id);
  };

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (!user) {
        if (active) {
          setIsAdmin(false);
          setNickname("");
          setEmail("");
        }
        return;
      }
      try {
        const profile = await getUserProfile(user.uid);
        if (active) {
          setIsAdmin(profile?.role === "admin");
          setNickname(profile?.nickname || "");
          setEmail(user.email || "");
        }
      } catch {
        if (active) {
          setIsAdmin(false);
          setNickname("");
          setEmail(user.email || "");
        }
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible) return;
    const closeButton = document.querySelector<HTMLButtonElement>(".site-sidebar-panel .sidebar-close");
    closeButton?.focus();
  }, [visible]);

  if (!visible) return null;

  return createPortal(
    <div className="site-sidebar-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Navigační nabídka">
      <nav className="site-sidebar-panel" onClick={event => event.stopPropagation()} aria-label="Hlavní navigace">
        <div className="site-sidebar-header">
          <div>
            <span>Navigace</span>
            <small className="site-sidebar-subtitle">{nickname || email || "Dolní Lhota v pohybu"}</small>
          </div>
          <button type="button" className="site-sidebar-icon-button" onClick={onClose} aria-label="Zavřít navigaci">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <button type="button" className={`site-sidebar-profile${pathname === "/profile" ? " is-active" : ""}`} aria-current={pathname === "/profile" ? "page" : undefined} onClick={() => { onClose(); router.push("/profile"); }}>
          <span className="site-sidebar-profile-icon"><UserRound size={22} aria-hidden="true" /></span>
          <span className="site-sidebar-profile-copy">
            <strong>Můj účet</strong>
            <small>Profil, heslo a účet</small>
          </span>
        </button>

        <div className="site-sidebar-groups">
          {NAVIGATION_GROUPS.map(group => {
            const items = NAVIGATION_ITEMS.filter(item =>
              item.group === group.id && (!item.adminOnly || isAdmin)
            );
            if (!items.length) return null;
            return (
              <section className="site-sidebar-section" key={group.id} aria-labelledby={`sidebar-group-${group.id}`}>
                <h2 id={`sidebar-group-${group.id}`}>{group.label}</h2>
                <div className="site-sidebar-grid">
                  {items.map(item => { const { id, label, Icon, route } = item; const isActive = pathname === route || (route !== "/" && pathname.startsWith(route + "/")); return (
                    <button key={id} type="button" className={`site-sidebar-item${isActive ? " is-active" : ""}`} onClick={() => handleNavigation(id)} aria-current={isActive ? "page" : undefined}>
                      <Icon size={22} strokeWidth={2} aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <button type="button" className="site-sidebar-item sidebar-close" onClick={onClose}>
          <X size={20} aria-hidden="true" />
          <span>Zavřít</span>
        </button>
      </nav>
    </div>,
    document.body
  );
}
