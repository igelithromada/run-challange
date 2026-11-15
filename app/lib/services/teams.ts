import { collection, collectionGroup, doc, getDoc, getDocs, query, where, orderBy, setDoc, limit, startAfter, type Query, type SetOptions, type QueryDocumentSnapshot, type DocumentData } from "firebase/firestore";
import { db } from "../firebase";
import type { TeamData } from "../../types";

export const teamsCollection = () => collection(db, "teams");

export function allTeamsQuery(): Query {
  return query(teamsCollection(), orderBy("name", "asc"));
}

export function teamRef(teamId: string) {
  return doc(db, "teams", teamId);
}

export async function getTeam(teamId: string): Promise<TeamData | null> {
  const snapshot = await getDoc(teamRef(teamId));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as TeamData) : null;
}

export async function getActiveTeamIdsForUser(userId: string): Promise<string[]> {
  const snapshot = await getDocs(
    query(collectionGroup(db, "members"), where("userId", "==", userId), where("active", "==", true))
  );
  return snapshot.docs
    .map(item => item.ref.parent.parent?.id || "")
    .filter(Boolean);
}

export async function getTeamMemberIds(teamId: string): Promise<string[]> {
  const snapshot = await getDocs(
    query(collection(db, "teams", teamId, "members"), where("active", "==", true))
  );
  return snapshot.docs.map(item => item.id);
}

export async function mergeTeam(
  teamId: string,
  data: Partial<Omit<TeamData, "id">>,
  options: SetOptions = { merge: true }
): Promise<void> {
  await setDoc(teamRef(teamId), data, options);
}
