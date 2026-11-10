import { collection, doc, getDoc, getDocs, query, setDoc, where, documentId, type SetOptions } from "firebase/firestore";
import { db } from "../firebase";
import type { UserData } from "../../types";
import { getPublicProfiles } from "./publicProfiles";
import { collection, getDocs, query, where, documentId } from "firebase/firestore";

export async function getUserProfile(uid: string): Promise<UserData | null> {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as UserData) : null;
}

export async function mergeUserProfile(
  uid: string,
  data: Partial<Omit<UserData, "id">>,
  options: SetOptions = { merge: true }
): Promise<void> {
  await setDoc(doc(db, "users", uid), data, options);
}

export async function getUserAvatars(uids: string[]): Promise<Record<string, string>> {
  const profiles = await getPublicProfiles(uids);
  const result: Record<string, string> = {};
  const missing = uids.filter(uid => !profiles[uid]);

  Object.entries(profiles).forEach(([uid, profile]) => {
    result[uid] = profile.avatarUrl || "";
  });

  if (missing.length) {
    const batches: string[][] = [];
    for (let index = 0; index < missing.length; index += 30) batches.push(missing.slice(index, index + 30));
    const snapshots = await Promise.all(
      batches.map(batch => getDocs(query(collection(db, "users"), where(documentId(), "in", batch))))
    );
    snapshots.forEach(snapshot => snapshot.docs.forEach(user => {
      result[user.id] = typeof user.data().avatarUrl === "string" ? user.data().avatarUrl : "";
    }));
  }

  return result;
}
