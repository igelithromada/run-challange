"use client";
import React from "react";

type NavbarProps = {
  onMenuClick: () => void;
};

export default function Navbar({ onMenuClick }: NavbarProps) {
  return (
    <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white px-6 py-4 flex justify-between items-center shadow-md">
      <div className="font-bold text-xl">Dolní Lhota v pohybu</div>
      <button 
        onClick={onMenuClick}
        className="text-3xl hover:text-orange-200 transition duration-200"
        aria-label="Menu"
      >
        ☰
      </button>
    </div>
  );
}
