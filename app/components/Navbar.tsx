"use client";
import React, { useEffect, useState } from "react";

type NavbarProps = {
  onMenuClick: () => void;
  onHomeClick?: () => void;
  showHome?: boolean;
  title?: string;
};

export default function Navbar({ onMenuClick, onHomeClick, showHome = true, title = "Dolní Lhota v pohybu" }: NavbarProps) {
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY > lastScrollY && currentY > 60) {
        setVisible(false); // scroll dolů → skrýt
      } else {
        setVisible(true); // scroll nahoru → zobrazit
      }
      setLastScrollY(currentY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <div
      style={{
        position: "fixed",
        top: visible ? 0 : -70, // skryje lištu
        left: 0,
        right: 0,
        background: "rgba(0, 0, 0, 0.2)",
        color: "white",
        padding: "0.6rem 1.2rem",
        display: "grid",
        gridTemplateColumns: "40px minmax(0, 1fr) 40px",
        gap: "0.5rem",
        alignItems: "center",
        fontFamily: "'Poppins', sans-serif",
        borderRadius: "0 0 15px 15px",
        zIndex: 1000,
        backdropFilter: "blur(8px)",
        transition: "top 0.3s ease"
      }}
    >
      <div
        onClick={onHomeClick}
        style={{ cursor: showHome ? "pointer" : "default", minWidth: "24px" }}
      >
        {showHome && (
          <svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24" width="24" height="24">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
        )}
      </div>

      <div
        style={{
          minWidth: 0,
          textAlign: "center",
          fontWeight: 600,
          fontSize: "clamp(.95rem, 4vw, 1.15rem)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }}
      >
        {title}
        <span style={{ marginLeft: "0.45rem", padding: "0.15rem 0.4rem", borderRadius: "6px", background: "#f59e0b", color: "#111827", fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.04em", verticalAlign: "middle" }}>TEST NASAZENÍ</span>
      </div>

      <div
        onClick={onMenuClick}
        style={{
          fontSize: "1.6rem",
          cursor: "pointer",
          userSelect: "none",
          textAlign: "right"
        }}
      >
        ☰
      </div>
    </div>
  );
}