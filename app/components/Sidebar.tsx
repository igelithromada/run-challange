"use client";
import React, { useEffect } from "react";
import { Footprints, Users, Trophy, SlidersHorizontal, ShieldCheck, LogOut, X, CloudSun, Home, TrendingUp } from "lucide-react";

type SidebarProps = { visible: boolean; onClose: () => void; onSelect: (item: string) => void };

const items = [
  { id: "home", label: "Hlavní obrazovka", Icon: Home },
  { id: "myrun", label: "Moje aktivity", Icon: Footprints },
  { id: "teams", label: "Týmy", Icon: Users },
  { id: "progress", label: "Můj progres", Icon: TrendingUp },
  { id: "statistics", label: "Výsledky", Icon: Trophy },
  { id: "weather", label: "Počasí pro běh", Icon: CloudSun },
  { id: "settings", label: "Nastavení", Icon: SlidersHorizontal },
  { id: "admin", label: "Admin", Icon: ShieldCheck },
];

export default function Sidebar({ visible, onClose, onSelect }: SidebarProps) {
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, onClose]);

  if (!visible) return null;
  return (
    <div className="site-sidebar-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Navigační nabídka">
      <nav className="site-sidebar-panel" onClick={e => e.stopPropagation()} aria-label="Hlavní navigace">
        {items.map(({id,label,Icon}) => (
          <button key={id} type="button" className="site-sidebar-item" onClick={() => onSelect(id)}>
            <Icon size={22} strokeWidth={2} /><span>{label}</span>
          </button>
        ))}
        <button type="button" className="site-sidebar-item site-sidebar-logout" onClick={() => onSelect("logout")}>
          <LogOut size={22} /><span>Odhlásit</span>
        </button>
        <button type="button" className="site-sidebar-item sidebar-close" onClick={onClose}>
          <X size={20} /><span>Zavřít</span>
        </button>
      </nav>
    </div>
  );
}
