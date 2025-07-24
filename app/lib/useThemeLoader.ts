"use client";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export default function useThemeLoader() {
  useEffect(() => {
    let userData = { theme: "default", customColor: "#36D1DC" };

    const applyCurrentTheme = () => {
      applyTheme(userData.theme, userData.customColor);
    };

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          userData = {
            theme: data.theme || "default",
            customColor: data.customColor || "#36D1DC"
          };
          applyCurrentTheme();
        }
      }
    });

    const interval = setInterval(() => {
      applyCurrentTheme();
    }, 300000); // každých 5 minut (300000 ms)

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);
}

const applyTheme = (selectedTheme, color) => {
  let gradient = "";

  if (selectedTheme === "default") {
    gradient = "linear-gradient(180deg, #36D1DC, #5B86E5)";
  } else if (selectedTheme === "man") {
    gradient = "linear-gradient(180deg, #2980b9, #2c3e50)";
  } else if (selectedTheme === "woman") {
    gradient = "linear-gradient(180deg, #ff7eb3, #ff758c)";
  } else if (selectedTheme === "auto") {
    const hour = new Date().getHours();
    gradient = `linear-gradient(180deg, ${getColorByHour(hour)}, #000000)`;
  } else if (selectedTheme === "custom") {
    gradient = `linear-gradient(180deg, ${color}, #000000)`;
  }

  document.documentElement.style.setProperty("--main-gradient", gradient);
};

const getColorByHour = (hour) => {
  let lightness = 90;
  if (hour < 6) lightness = 20;
  else if (hour < 10) lightness = 70;
  else if (hour < 16) lightness = 90;
  else if (hour < 20) lightness = 60;
  else lightness = 30;

  return `hsl(200, 70%, ${lightness}%)`;
};