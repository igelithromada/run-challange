"use client";
import React from "react";

export default function Navbar({ onMenuClick }) {
  return (
    <div style={{
      backgroundColor: "orange", color: "black", padding: "1rem",
      display: "flex", justifyContent: "space-between", alignItems: "center"
    }}>
      <div style={{ fontWeight: "bold", fontSize: "1.2rem" }}>Dolní Lhota v pohybu</div>
      <div onClick={onMenuClick} style={{ fontSize: "1.5rem", cursor: "pointer" }}>☰</div>
    </div>
  );
}