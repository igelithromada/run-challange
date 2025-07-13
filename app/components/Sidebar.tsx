"use client";
import React from "react";

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (item: string) => void;
}

export default function Sidebar({ visible, onClose, onSelect }: SidebarProps) {
  if (!visible) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "200px",
      height: "100%",
      backgroundColor: "#eee",
      padding: "1rem"
    }}>
      <div
        style={{ cursor: "pointer", marginBottom: "1rem" }}
        onClick={() => onSelect("myrun")}
      >
        Moje běhy
      </div>
      <div
        style={{ cursor: "pointer", marginBottom: "1rem" }}
        onClick={() => onSelect("teams")}
      >
        Týmy
      </div>
      <div
        style={{ cursor: "pointer", marginBottom: "1rem" }}
        onClick={() => onSelect("settings")}
      >
        Nastavení
      </div>
      <div
        style={{ cursor: "pointer", marginBottom: "1rem" }}
        onClick={() => onSelect("statistics")}
      >
        Statistiky
      </div>
      <div
        style={{ cursor: "pointer", color: "red" }}
        onClick={() => onSelect("logout")}
      >
        Odhlásit se
      </div>
      <button
        onClick={onClose}
        style={{
          marginTop: "20px",
          padding: "5px 10px",
          backgroundColor: "gray",
          color: "white",
          borderRadius: "3px"
        }}
      >
        Zavřít
      </button>
    </div>
  );
}
