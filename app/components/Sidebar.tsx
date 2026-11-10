"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Footprints, Users, Trophy, SlidersHorizontal, ShieldCheck, LogOut, X, CloudSun, TrendingUp, ListOrdered, Dumbbell, Map } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { getUserProfile } from "../lib/services/users";
import { useRouter } from "next/navigation";

type SidebarProps = { visible: boolean; onClose: () => void; onSelect: (item: string) => void };

const items = [
  { id: "myrun", label: "Moje aktivity", Icon: Footprints },
  { id: "teams", label: "Týmy", Icon: Users },
  { id: "progress", label: "Můj progres", Icon: TrendingUp },
  { id: "trainer", label: "Osobní trenér", Icon: Dumbbell },
  { id: "statistics", label: "Výsledky", Icon: Trophy },
  { id: "participants", label: "Účastníci", Icon: ListOrdered },
  { id: "weather", label: "Počasí pro běh", Icon: CloudSun },
  { id: "routes", label: "Doporučené trasy", Icon: Map },
  { id: "settings", label: "Nastavení", Icon: SlidersHorizontal },
];

export default function Sidebar({ visible, onClose, onSelect }: SidebarProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  const handleNavigation = (id: string) => {
    if (id === "routes") {
      onClose();
      router.push("/routes");
      return;
    }
    onSelect(id);
  };

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (!user) {
        if (active) setIsAdmin(false);
        return;
      }
      try {
        const profile = await getUserProfile(user.uid);
        if (active) setIsAdmin(profile?.role === "admin");
      } catch {
        if (active) setIsAdmin(false);
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

  const navigationItems = isAdmin
    ? [...items, { id: "admin", label: "Administrace", Icon: ShieldCheck }]
    : items;

  return createPortal(
    <div className="site-sidebar-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Navigační nabídka">
      <nav className="site-sidebar-panel" onClick={event => event.stopPropagation()} aria-label="Hlavní navigace">
        <div className="site-sidebar-header">
          <span>Navigace</span>
          <button type="button" className="site-sidebar-icon-button" onClick={onClose} aria-label="Zavřít navigaci">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="site-sidebar-grid">
          {navigationItems.map(({ id, label, Icon }) => (
            <button key={id} type="button" className="site-sidebar-item" onClick={() => handleNavigation(id)}>
              <Icon size={22} strokeWidth={2} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <button type="button" className="site-sidebar-item site-sidebar-logout" onClick={() => onSelect("logout")}>
          <LogOut size={22} aria-hidden="true" />
          <span>Odhlásit</span>
        </button>
        <button type="button" className="site-sidebar-item sidebar-close" onClick={onClose}>
          <X size={20} aria-hidden="true" />
          <span>Zavřít</span>
        </button>
      </nav>
    </div>,
    document.body
  );
}
