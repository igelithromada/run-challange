"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { CHAT_CHANGED } from "./chat";

export const ChatAvailability = createContext<boolean | null>(null);
export const useChatAvailability = () => useContext(ChatAvailability);

export function useChatLive(uid: string) {
  const [status, setStatus] = useState<{ uid: string; enabled: boolean }>();
  useEffect(() => {
    if (!uid) return;
    let unsubscribe: (() => void) | undefined;
    let revision: string | undefined;

    function disconnect() {
      unsubscribe?.();
      unsubscribe = undefined;
    }

    function updateConnection() {
      if (document.visibilityState !== "visible" || auth.currentUser?.uid !== uid) {
        disconnect();
        return;
      }
      if (unsubscribe) return;
      unsubscribe = onSnapshot(doc(db, "chatMeta", "community"), { includeMetadataChanges: true }, snapshot => {
        if (auth.currentUser?.uid !== uid || snapshot.metadata.fromCache) return;
        const enabled = snapshot.data()?.enabled !== false;
        setStatus(current => current?.uid === uid && current.enabled === enabled ? current : { uid, enabled });
        const next = String(snapshot.data()?.revision || "empty");
        if (next === revision) return;
        revision = next;
        window.dispatchEvent(new Event(CHAT_CHANGED));
      }, disconnect);
    }

    updateConnection();
    document.addEventListener("visibilitychange", updateConnection);
    window.addEventListener("online", updateConnection);
    return () => {
      disconnect();
      document.removeEventListener("visibilitychange", updateConnection);
      window.removeEventListener("online", updateConnection);
    };
  }, [uid]);
  return uid && status?.uid === uid ? status.enabled : null;
}
