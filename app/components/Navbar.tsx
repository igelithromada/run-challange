"use client";

import React, { useEffect, useRef, useState } from "react";
import { Home, Menu } from "lucide-react";

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
        <button type="button" className="site-navbar-button" onClick={onMenuClick} aria-label="Otevřít navigaci">
          <Menu size={25} strokeWidth={2.1} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
