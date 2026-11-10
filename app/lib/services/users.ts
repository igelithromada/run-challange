import { collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp, type SetOptions } from "firebase/firestore";
import { db } from "../firebase";
import type { UserData } from "../../types";
import { getPublicProfiles } from "./publicProfiles";

export async function getAllUserProfiles(): Promise<UserData[]> {
  const snapshot = await getDocs(collection(db, "users"));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() } as UserData));
}

export async function updateUserProfile(uid: string, data: Partial<Omit<UserData, "id">>): Promise<void> {
  await updateDoc(doc(db, "users", uid), data);
}

export async function getUserProfile(uid: string): Promise<UserData | null> {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as UserData) : null;
}

export async function saveUserSettings(
  uid: string,
  data: Record<string, unknown>,
  themeChanged = false
): Promise<void> {
  await setDoc(
    doc(db, "users", uid),
    {
      ...data,
      ...(themeChanged ? { themeUpdatedAt: serverTimestamp() } : {}),
    },
    { merge: true }
  );
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

  Object.entries(profiles).forEach(([uid, profile]) => {
    result[uid] = profile.avatarUrl || "";
  });

  return result;
}
