"use client";

import { useEffect, useState } from "react";

export type AppToastType = "success" | "error" | "info";
export const APP_TOAST_EVENT = "dolni-lhota:toast";

export function showAppToast(message: string, type: AppToastType = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(APP_TOAST_EVENT, { detail: { message, type } }));
}

export default function AppToast() {
  const [toast, setToast] = useState<{message:string;type:AppToastType}|null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const handle = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail?.message) return;
      if (timer) window.clearTimeout(timer);
      setToast({ message: String(detail.message), type: detail.type || "success" });
      timer = window.setTimeout(() => setToast(null), 3000);
    };
    window.addEventListener(APP_TOAST_EVENT, handle);
    return () => {
      window.removeEventListener(APP_TOAST_EVENT, handle);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;
  return <div className={`app-toast app-toast-${toast.type}`} role="status" aria-live="polite">{toast.message}</div>;
}
