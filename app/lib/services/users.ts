import { collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp, type SetOptions } from "firebase/firestore";
import { db } from "../firebase";
import type { UserData } from "../../types";
import { getPublicProfiles } from "./publicProfiles";

const USER_PROFILE_CACHE_TTL = 10_000;
const userProfileCache = new Map<string, { data: UserData | null; expiresAt: number }>();
const userProfileRequests = new Map<string, Promise<UserData | null>>();

export function invalidateUserProfileCache(uid: string): void {
  userProfileCache.delete(uid);
}

export async function getAllUserProfiles(): Promise<UserData[]> {
  const snapshot = await getDocs(collection(db, "users"));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() } as UserData));
}

export async function getUserProfile(uid: string): Promise<UserData | null> {
  const cached = userProfileCache.get(uid);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const pending = userProfileRequests.get(uid);
  if (pending) return pending;

  const request = getDoc(doc(db, "users", uid))
    .then(snapshot => {
      const data = snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as UserData) : null;
      userProfileCache.set(uid, { data, expiresAt: Date.now() + USER_PROFILE_CACHE_TTL });
      return data;
    })
    .finally(() => {
      userProfileRequests.delete(uid);
    });

  userProfileRequests.set(uid, request);
  return request;
}

export async function updateUserProfile(uid: string, data: Record<string, unknown>): Promise<void> {
  await updateDoc(doc(db, "users", uid), data);
  invalidateUserProfileCache(uid);
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
  invalidateUserProfileCache(uid);
}

export async function mergeUserProfile(
  uid: string,
  data: Partial<Omit<UserData, "id">>,
  options: SetOptions = { merge: true }
): Promise<void> {
  await setDoc(doc(db, "users", uid), data, options);
  invalidateUserProfileCache(uid);
}

export async function getUserAvatars(uids: string[]): Promise<Record<string, string>> {
  const profiles = await getPublicProfiles(uids);
  const result: Record<string, string> = {};

  Object.entries(profiles).forEach(([uid, profile]) => {
    result[uid] = profile.avatarUrl || "";
  });

  return result;
}
