"use client";
import React from "react";
import { Footprints, Users, Trophy, SlidersHorizontal, ShieldCheck, LogOut, X, CloudSun, Home, TrendingUp } from "lucide-react";

type SidebarProps = { visible: boolean; onClose: () => void; onSelect: (item: string) => void };

const items = [
  { id:"home", label:"Hlavní obrazovka", Icon:Home },
  { id:"myrun", label:"Moje aktivity", Icon:Footprints },
  { id:"teams", label:"Týmy", Icon:Users },
  { id:"progress", label:"Můj progres", Icon:TrendingUp },
  { id:"statistics", label:"Výsledky", Icon:Trophy },
  { id:"weather", label:"Počasí pro běh", Icon:CloudSun },
  { id:"settings", label:"Nastavení", Icon:SlidersHorizontal },
  { id:"admin", label:"Admin", Icon:ShieldCheck },
];

export default function Sidebar({visible,onClose,onSelect}:SidebarProps) {
  if (!visible) return null;
  return <div className="app-menu-overlay" onClick={onClose}>
    <nav className="app-menu-panel" aria-label="Hlavní navigace" onClick={e=>e.stopPropagation()}>
      <div className="app-menu-grid">
        {items.map(({id,label,Icon})=><button type="button" className="app-menu-item" key={id} onClick={()=>onSelect(id)}><Icon size={25} strokeWidth={2}/><span>{label}</span></button>)}
        <button type="button" className="app-menu-item app-menu-logout" onClick={()=>onSelect("logout")}><LogOut size={25}/><span>Odhlásit</span></button>
      </div>
      <button type="button" className="app-menu-close" onClick={onClose}><X size={19}/> Zavřít</button>
    </nav>
  </div>;
}
