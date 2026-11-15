import { collection, doc, getDoc, getDocs, orderBy, query, where, type Query } from "firebase/firestore";
import { db } from "../firebase";
import type { ChallengeData } from "../../types";

export function allChallengesQuery(): Query {
  return query(collection(db, "challenges"), orderBy("name", "asc"));
}

export async function getChallenge(id: string): Promise<ChallengeData | null> {
  const snap = await getDoc(doc(db, "challenges", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as ChallengeData) : null;
}

export async function getChallengeParticipants(id: string) {
  const snap = await getDocs(query(collection(db, "challenges", id, "participants"), where("active", "==", true)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
