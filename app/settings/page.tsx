"use client";
import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { applyTheme } from "../lib/useThemeLoader";
import { useRouter } from "next/navigation";
import { HexColorPicker } from "react-colorful";

export default function SettingsPage() {

  const [menuVisible, setMenuVisible] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [theme, setTheme] = useState("default");
  const [customColor, setCustomColor] = useState("#36D1DC");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [nicknameSaving, setNicknameSaving] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        setEmail(user.email || "");
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          setNickname(data.nickname || "");
          setAvatarUrl(data.avatarUrl || "");
          setTheme(data.theme === "weather" ? "default" : (data.theme || "default"));
          setCustomColor(data.customColor || "#36D1DC");
          setAnimationsEnabled(data.animationsEnabled !== false);
          applyTheme(data.theme === "weather" ? "default" : (data.theme || "default"), data.customColor || "#36D1DC", data.animations...[truncated]