"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import WeatherCard from "../components/WeatherCard";

export default function WeatherPage() {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  return (
    <>
      <Navbar title="Počasí" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} />
      <main className="container weather-page">
        <WeatherCard />
      </main>
    </>
  );
}