"use client";

import { useEffect, useState } from "react";

export default function NetworkStatus() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      setVisible(!navigator.onLine);
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(error => {
        console.warn("Service worker se nepodařilo zaregistrovat:", error);
      });
    }
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!visible) return null;
  return (
    <div className="network-status" role="status" aria-live="polite">
      <span className="network-status-dot" />
      Jsi offline – zobrazuji dostupná uložená data
    </div>
  );
}
