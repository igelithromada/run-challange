import { collection, doc, getDoc, getDocs, query, setDoc, where, documentId, type SetOptions } from "firebase/firestore";
import { db } from "../firebase";
import type { UserData } from "../../types";

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
  const uniqueIds = Array.from(new Set(uids.filter(Boolean)));
  const result: Record<string, string> = {};
  const batches: string[][] = [];

  for (let index = 0; index < uniqueIds.length; index += 30) {
    batches.push(uniqueIds.slice(index, index + 30));
  }

  const snapshots = await Promise.all(
    batches.map(batch =>
      getDocs(query(collection(db, "users"), where(documentId(), "in", batch)))
    )
  );

  snapshots.forEach(snapshot => {
    snapshot.docs.forEach(user => {
      const data = user.data();
      result[user.id] = typeof data.avatarUrl === "string" ? data.avatarUrl : "";
    });
  });

  return result;
}
