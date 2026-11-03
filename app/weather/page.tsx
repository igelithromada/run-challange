"use client";

import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import WeatherCard from "../components/WeatherCard";
import useThemeLoader from "../lib/useThemeLoader";

export default function WeatherPage() {
  useThemeLoader();
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
    } else if (item === "myrun") router.push("/myruns");
    else if (item === "teams") router.push("/teams");
    else if (item === "statistics") router.push("/statistics");
    else if (item === "settings") router.push("/settings");
    else if (item === "admin") router.push("/admin");
    else if (item === "weather") router.push("/weather");
  };

  return (
    <>
      <Navbar onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />
      <main className="container">
        <h1 className="centered-title">Počasí pro běh</h1>
        <WeatherCard />
        <p style={{ textAlign: "center", opacity: 0.75, fontSize: "0.85rem" }}>
          Předpověď pro Dolní Lhotu u Ostravy. Data se obnovují automaticky.
        </p>
      </main>
    </>
  );
}
