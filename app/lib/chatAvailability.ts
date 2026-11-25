import type { Firestore } from "firebase-admin/firestore";

export const CHAT_DISABLED_MESSAGE = "Společný chat je vypnutý.";

export function chatState(db: Firestore) {
  return db.collection("chatMeta").doc("community");
}
