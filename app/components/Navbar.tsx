"use client";
import React, { useEffect, useState } from "react";

type NavbarProps = {
  onMenuClick: () => void;
  onHomeClick?: () => void;
  showHome?: boolean;
};

export default function Navbar({ onMenuClick, onHomeClick, showHome = true }: NavbarProps) {
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
        display: "flex",
        justifyContent: "space-between",
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
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          fontWeight: 600,
          fontSize: "1.2rem"
        }}
      >
        Dolní Lhota v pohybu
      </div>

      <div
        onClick={onMenuClick}
        style={{
          fontSize: "1.6rem",
          cursor: "pointer",
          userSelect: "none"
        }}
      >
        ☰
      </div>
    </div>
  );
}