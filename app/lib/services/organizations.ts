import { collection, doc, getDoc, setDoc, type SetOptions } from "firebase/firestore";
import { db } from "../firebase";
import type { OrganizationData } from "../../types";

export async function getOrganization(id: string): Promise<OrganizationData | null> {
  const snapshot = await getDoc(doc(db, "organizations", id));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as OrganizationData) : null;
}

export async function mergeOrganization(
  id: string,
  data: Partial<Omit<OrganizationData, "id">>,
  options: SetOptions = { merge: true }
): Promise<void> {
  await setDoc(doc(db, "organizations", id), data, options);
}

export function organizationsCollection() {
  return collection(db, "organizations");
}
