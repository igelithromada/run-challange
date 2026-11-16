import { collection, collectionGroup, doc, getDoc, getDocs, query, where, orderBy, setDoc, limit, startAfter, type Query, type SetOptions, type QueryDocumentSnapshot, type DocumentData } from "firebase/firestore";
import { db } from "../firebase";
import type { TeamData } from "../../types";

export const teamsCollection = () => collection(db, "teams");

export function allTeamsQuery(pageSize = 10, cursor?: QueryDocumentSnapshot<DocumentData, DocumentData>): Query {
  const constraints = cursor
    ? [orderBy("name", "asc"), startAfter(cursor), limit(pageSize)]
    : [orderBy("name", "asc"), limit(pageSize)];
  return query(teamsCollection(), ...constraints);
}

export async function fetchTeamsPage(
  pageSize = 10,
  cursor?: QueryDocumentSnapshot<DocumentData, DocumentData>
): Promise<{ items: TeamData[]; lastDocument: QueryDocumentSnapshot<DocumentData, DocumentData> | null; hasMore: boolean }> {
  const snapshot = await getDocs(allTeamsQuery(pageSize, cursor));
  return {
    items: snapshot.docs.map(item => ({ id: item.id, ...item.data() } as TeamData)),
    lastDocument: snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null,
    hasMore: snapshot.docs.length === pageSize,
  };
}

export function teamRef(teamId: string) {
  return doc(db, "teams", teamId);
}

export async function getTeam(teamId: string): Promise<TeamData | null> {
  const snapshot = await getDoc(teamRef(teamId));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as TeamData) : null;
}

export async function getActiveTeamIdsForUser(userId: string): Promise<string[]> {
  // Query only by userId. The previous compound query (userId + active)
  // required a collection-group composite index and broke team loading on
  // production when that index was not present. Active membership is cheap
  // to filter client-side here and keeps this path index-independent.
  const snapshot = await getDocs(
    query(collectionGroup(db, "members"), where("userId", "==", userId))
  );
  return snapshot.docs
    .filter(item => item.data()?.active === true)
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
