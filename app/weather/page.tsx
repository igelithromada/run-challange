"use client";

import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import WeatherCard from "../components/WeatherCard";
import RunWeatherRecommendation from "../components/RunWeatherRecommendation";

export default function WeatherPage() {
  const [menuVisible, setMenuVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) router.push("/login");
    });
    return () => unsubscribe();
  }, [router]);

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") {
      await signOut(auth);
      router.push("/login");
    } else if (item === "home") router.push("/");
    else if (item === "myrun") router.push("/myruns");
    else if (item === "teams") router.push("/teams");
    else if (item === "statistics") router.push("/statistics");
    else if (item === "participants") router.push("/participants");
    else if (item === "settings") router.push("/settings");
    else if (item === "admin") router.push("/admin");
    else if (item === "weather") router.push("/weather");
    else if (item === "progress") router.push("/progress");
  };

  return (
    <>
      <Navbar title="Počasí pro běh" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />
      <main className="container">
        
        <WeatherCard />
        <RunWeatherRecommendation linkToWeather={false} />
        <p style={{ textAlign: "center", opacity: 0.75, fontSize: "0.85rem" }}>
          Předpověď pro Dolní Lhotu u Ostravy. Data se obnovují automaticky.
        </p>
      </main>
    </>
  );
}
