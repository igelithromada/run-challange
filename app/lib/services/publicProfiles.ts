import { collection, doc, getDoc, getDocs, query, where, documentId, setDoc, type SetOptions } from "firebase/firestore";
import { db } from "../firebase";
import type { PublicProfileData } from "../../types";

export async function getPublicProfile(uid: string): Promise<PublicProfileData | null> {
  const snapshot = await getDoc(doc(db, "publicProfiles", uid));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as PublicProfileData) : null;
}

export async function mergePublicProfile(
  uid: string,
  data: Partial<Omit<PublicProfileData, "id">>,
  options: SetOptions = { merge: true }
): Promise<void> {
  await setDoc(doc(db, "publicProfiles", uid), data, options);
}

export async function getPublicProfiles(uids: string[]): Promise<Record<string, PublicProfileData>> {
  const uniqueIds = Array.from(new Set(uids.filter(Boolean)));
  const result: Record<string, PublicProfileData> = {};
  const batches: string[][] = [];

  for (let index = 0; index < uniqueIds.length; index += 30) {
    batches.push(uniqueIds.slice(index, index + 30));
  }

  const snapshots = await Promise.all(
    batches.map(batch =>
      getDocs(query(collection(db, "publicProfiles"), where(documentId(), "in", batch)))
    )
  );

  snapshots.forEach(snapshot => {
    snapshot.docs.forEach(profile => {
      result[profile.id] = { id: profile.id, ...profile.data() } as PublicProfileData;
    });
  });

  return result;
}
