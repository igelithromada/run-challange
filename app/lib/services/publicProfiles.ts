import { doc, getDoc, setDoc, type SetOptions } from "firebase/firestore";
import { db } from "../firebase";
import type { PublicProfileData } from "../../types";

const PROFILE_CACHE_TTL = 15_000;
const profileCache = new Map<string, { data: PublicProfileData | null; expiresAt: number }>();
const profileRequests = new Map<string, Promise<PublicProfileData | null>>();

export function invalidatePublicProfileCache(uid: string): void {
  profileCache.delete(uid);
}

async function loadPublicProfile(uid: string): Promise<PublicProfileData | null> {
  const snapshot = await getDoc(doc(db, "publicProfiles", uid));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as PublicProfileData) : null;
}

export async function getPublicProfile(uid: string): Promise<PublicProfileData | null> {
  if (!uid) return null;

  const cached = profileCache.get(uid);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const pending = profileRequests.get(uid);
  if (pending) return pending;

  const request = loadPublicProfile(uid)
    .then(data => {
      profileCache.set(uid, { data, expiresAt: Date.now() + PROFILE_CACHE_TTL });
      return data;
    })
    .finally(() => {
      profileRequests.delete(uid);
    });

  profileRequests.set(uid, request);
  return request;
}

export async function mergePublicProfile(
  uid: string,
  data: Partial<Omit<PublicProfileData, "id">>,
  options: SetOptions = { merge: true }
): Promise<void> {
  await setDoc(doc(db, "publicProfiles", uid), data, options);
  invalidatePublicProfileCache(uid);
}

export async function getPublicProfiles(uids: string[]): Promise<Record<string, PublicProfileData>> {
  const uniqueIds = Array.from(new Set(uids.filter(Boolean)));
  const entries = await Promise.all(uniqueIds.map(async uid => {
    const profile = await getPublicProfile(uid);
    return profile ? [uid, profile] as const : null;
  }));

  return entries.reduce<Record<string, PublicProfileData>>((result, entry) => {
    if (entry) result[entry[0]] = entry[1];
    return result;
  }, {});
}
