"use client";

import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { expireNotificationCount } from "./notificationCount";

export const FRESH_REACTION = "dolni-lhota:fresh-reaction";

export function subscribeToFreshReactions() {
  let uid: string | undefined;
  let revision: string | undefined;
  let stop: (() => void) | undefined;

  function disconnect() {
    stop?.();
    stop = undefined;
  }

  function connect() {
    const viewer = uid;
    if (!viewer || document.visibilityState !== "visible") {
      disconnect();
      return;
    }
    if (stop) return;

    stop = onSnapshot(doc(db, "notificationSignals", viewer), { includeMetadataChanges: true }, snapshot => {
      if (auth.currentUser?.uid !== viewer || snapshot.metadata.fromCache) return;
      const next = snapshot.data()?.revision;
      if (typeof next !== "string" || next === revision) return;
      revision = next;
      expireNotificationCount(viewer);
      window.dispatchEvent(new CustomEvent(FRESH_REACTION, { detail: { uid: viewer } }));
    }, disconnect);
  }

  const unsubscribe = onAuthStateChanged(auth, user => {
    if (uid !== user?.uid) {
      disconnect();
      revision = undefined;
      uid = user?.uid;
    }
    connect();
  });
  document.addEventListener("visibilitychange", connect);
  window.addEventListener("online", connect);
  return () => {
    disconnect();
    unsubscribe();
    document.removeEventListener("visibilitychange", connect);
    window.removeEventListener("online", connect);
  };
}
