"use client";

import { auth } from "./firebase";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = window.atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

export async function registerTrainerPush() {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Tento prohlížeč nepodporuje systémové push notifikace.");
  }
  if (!VAPID_PUBLIC_KEY) throw new Error("Push notifikace nejsou ještě nakonfigurované.");
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Povolení k notifikacím nebylo uděleno.");
  const registration = await navigator.serviceWorker.register("/sw.js");
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY)
  });
  const user = auth.currentUser;
  if (!user) throw new Error("Nejsi přihlášen.");
  const token = await user.getIdToken(true);
  const response = await fetch("/api/notifications/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ subscription: subscription.toJSON() })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Notifikace se nepodařilo zapnout.");
  return subscription;
}

export async function removeTrainerPush() {
  const user = auth.currentUser;
  if (!user || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (!subscription) return;
  const token = await user.getIdToken(true);
  await fetch("/api/notifications/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ endpoint: subscription.endpoint })
  }).catch(() => {});
  await subscription.unsubscribe().catch(() => {});
}
