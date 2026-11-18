"use client";

import { auth } from "./firebase";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = window.atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

async function registerPush(channel: 'trainer' | 'chat') {
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
    body: JSON.stringify({ channel, subscription: subscription.toJSON() })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Notifikace se nepodařilo zapnout.");
  return subscription;
}

async function removePush(channel: 'trainer' | 'chat') {
  const user = auth.currentUser;
  if (!user || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (!subscription) return;
  const token = await user.getIdToken();
  const response = await fetch("/api/notifications/subscribe", {
    method: "DELETE",
    signal: AbortSignal.timeout(2500),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ channel, endpoint: subscription.endpoint })
  });
  if (!response.ok) throw new Error("Notifikace se nepodařilo vypnout. Zkus to znovu.");
  // A single browser subscription can receive more than one category.
}


export const registerTrainerPush = () => registerPush('trainer');
export const removeTrainerPush = () => removePush('trainer');
export const registerChatPush = () => registerPush('chat');
export const removeChatPush = () => removePush('chat');

export async function getChatPushStatus() {
  const user = auth.currentUser;
  if (!user || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { enabled: false, ready: false };
  }
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  const response = await fetch("/api/notifications/subscribe", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ channel: 'chat', action: 'status', endpoint: subscription?.endpoint }),
  });
  if (!response.ok) throw new Error("Stav upozornění se nepodařilo načíst.");
  const status = await response.json();
  return { enabled: status.enabled === true && Notification.permission === 'granted', ready: status.ready === true && Boolean(VAPID_PUBLIC_KEY) };
}
