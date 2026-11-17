"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import WeatherCard from "../components/WeatherCard";

export default function WeatherPage() {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const handleSelect = (item: string) => {
    setMenuVisible(false);
    const routes: Record<string, string> = {
      home: "/", myrun: "/myruns", teams: "/teams", challenges: "/challenges",
      progress: "/progress", trainer: "/trainer", statistics: "/statistics",
      participants: "/participants", weather: "/weather", routes: "/routes",
      settings: "/settings", admin: "/admin",
    };
    if (item === "logout") {
      void import("firebase/auth").then(({ signOut }) => signOut(auth)).then(() => router.push("/login"));
      return;
    }
    router.push(routes[item] || "/");
  };
  return (
    <>
      <Navbar title="Počasí" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />
      <main className="container weather-page">
        <WeatherCard />
      </main>
    </>
  );
}