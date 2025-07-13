"use client";
import React from "react";

export default function Sidebar({ visible, onClose, onSelect }) {
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
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "white",
          padding: "2rem",
          borderRadius: "0.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          width: "80%",
          maxWidth: "300px",
          textAlign: "center",
        }}
      >
        <div
          style={{ cursor: "pointer", fontWeight: "bold", fontSize: "1.2rem" }}
          onClick={() => onSelect("myrun")}
        >
          🏃 Moje aktivity
        </div>
        <div
          style={{ cursor: "pointer", fontWeight: "bold", fontSize: "1.2rem" }}
          onClick={() => onSelect("statistics")}
        >
          📊 Statistiky
        </div>
        <div
          style={{ cursor: "pointer", fontWeight: "bold", fontSize: "1.2rem" }}
          onClick={() => onSelect("teams")}
        >
          👥 Týmy
        </div>
        <div
          style={{ cursor: "pointer", fontWeight: "bold", fontSize: "1.2rem" }}
          onClick={() => onSelect("settings")}
        >
          ⚙️ Nastavení účtu
        </div>
        <div
          style={{ cursor: "pointer", fontWeight: "bold", fontSize: "1.2rem", color: "red" }}
          onClick={() => onSelect("logout")}
        >
          🚪 Odhlásit
        </div>
        <div
          style={{ cursor: "pointer", marginTop: "1rem", color: "#555" }}
          onClick={onClose}
        >
          ❌ Zavřít
        </div>
      </div>
    </div>
  );
}