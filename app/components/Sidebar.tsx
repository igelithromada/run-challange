"use client";
import React from "react";

type SidebarProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (item: string) => void;
};

export default function Sidebar({ visible, onClose, onSelect }: SidebarProps) {
  if (!visible) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        width: "100vw",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
        backdropFilter: "blur(6px)",
        fontFamily: "'Poppins', sans-serif"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--main-gradient, linear-gradient(180deg, #36D1DC, #5B86E5))",
          padding: "2rem",
          borderRadius: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          width: "80%",
          maxWidth: "300px",
          textAlign: "center",
          boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
          color: "white"
        }}
      >
        <HoverTile onClick={() => onSelect("myrun")}>
          <RunIcon /> Moje aktivity
        </HoverTile>
        <HoverTile onClick={() => onSelect("teams")}>
          <UsersIcon /> Týmy
        </HoverTile>
        <HoverTile onClick={() => onSelect("statistics")}>
          <ChartIcon /> Výsledky
        </HoverTile>
        <HoverTile onClick={() => onSelect("settings")}>
          <SettingsIcon /> Nastavení
        </HoverTile>
        <HoverTile onClick={() => onSelect("logout")}
          styleOverride={{ background: "rgba(255,0,0,0.2)" }}
        >
          <LogoutIcon /> Odhlásit
        </HoverTile>

        <div
          style={{
            cursor: "pointer",
            marginTop: "1rem",
            color: "#eee",
            fontSize: "1rem"
          }}
          onClick={onClose}
        >
          ✕ Zavřít
        </div>
      </div>
    </div>
  );
}

function HoverTile({ children, onClick, styleOverride = {} }: {
  children: React.ReactNode;
  onClick: () => void;
  styleOverride?: React.CSSProperties;
}) {
  const [hover, setHover] = React.useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
        padding: "1rem",
        borderRadius: "15px",
        fontSize: "1.1rem",
        fontWeight: 600,
        color: "white",
        cursor: "pointer",
        boxShadow: hover ? "0 4px 12px rgba(0,0,0,0.3)" : "0 2px 6px rgba(0,0,0,0.2)",
        transition: "all 0.3s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.6rem",
        ...styleOverride
      }}
    >
      {children}
    </div>
  );
}

const iconStyle = { width: "20px", height: "20px", stroke: "white", strokeWidth: 2, fill: "none" };

function RunIcon() {
  return (
    <svg viewBox="0 0 24 24" style={iconStyle}>
      <path d="M13 2 L15 6 L19 8 L17 12 L19 16 L14 15 L12 20 L10 15 L5 14 L7 10 L5 6 L10 7 L13 2 Z" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" style={iconStyle}>
      <path d="M4 20 V10" />
      <path d="M10 20 V4" />
      <path d="M16 20 V14" />
      <path d="M22 20 V8" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" style={iconStyle}>
      <circle cx="9" cy="7" r="4"/>
      <path d="M2 22c0-4 5-6 7-6s7 2 7 6"/>
      <circle cx="17" cy="7" r="3"/>
      <path d="M15 22c0-3 4-5 6-5"/>
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" style={iconStyle}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06
      a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33
      1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65
      1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06
      a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82
      1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09c.66
      0 1.25-.38 1.51-1a1.65 1.65 0 0 0-.33-1.82L4.21 7
      a2 2 0 1 1 2.83-2.83l.06.06c.36.36.86.58
      1.38.58s1.02-.22 1.38-.58l.06-.06a2 2 0 1
      1 2.83 2.83l-.06.06c-.36.36-.58.86-.58 1.38s.22
      1.02.58 1.38l.06.06a1.65 1.65 0 0 0 1.82.33h.09
      a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" style={iconStyle}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );

}
