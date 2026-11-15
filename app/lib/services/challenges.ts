import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAfter, where, type Query, type QueryDocumentSnapshot, type DocumentData } from "firebase/firestore";
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

export async function fetchChallengesPage(
  activityType: ChallengeData["activityType"],
  state: ChallengeData["state"],
  monthStart: string,
  monthEnd: string,
  pageSize = 10,
  cursor?: QueryDocumentSnapshot<DocumentData, DocumentData>
): Promise<{ items: ChallengeData[]; lastDocument: QueryDocumentSnapshot<DocumentData, DocumentData> | null; hasMore: boolean }> {
  const constraints = [
    where("activityType", "==", activityType),
    where("state", "==", state),
    where("startDate", ">=", monthStart),
    where("startDate", "<=", monthEnd),
    orderBy("startDate", "asc"),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize),
  ] as const;
  const snapshot = await getDocs(query(collection(db, "challenges"), ...constraints));
  const items = snapshot.docs
    .map(d => ({ id: d.id, ...d.data() } as ChallengeData))
    .sort((a, b) => a.name.localeCompare(b.name, "cs"));
  return {
    items,
    lastDocument: snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null,
    hasMore: snapshot.docs.length === pageSize,
  };
}

export async function fetchChallengeParticipantsPage(
  id: string,
  challenge: Pick<ChallengeData, "state" | "kind">,
  pageSize = 10,
  cursor?: QueryDocumentSnapshot<DocumentData, DocumentData>
): Promise<{ items: any[]; lastDocument: QueryDocumentSnapshot<DocumentData, DocumentData> | null; hasMore: boolean }> {
  const orderField = challenge.state === "completed"
    ? "finalRank"
    : challenge.kind === "sharedDistance"
      ? "joinedAt"
      : "result";
  const orderDirection = challenge.state === "completed" || challenge.kind === "sharedDistance" ? "asc" : "desc";
  const constraints = [
    where("active", "==", true),
    orderBy(orderField, orderDirection),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize),
  ] as const;
  const snapshot = await getDocs(query(collection(db, "challenges", id, "participants"), ...constraints));
  return {
    items: snapshot.docs.map(d => ({ id: d.id, ...d.data() })),
    lastDocument: snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null,
    hasMore: snapshot.docs.length === pageSize,
  };
}

export async function getChallengeParticipant(id: string, userId: string) {
  const snap = await getDoc(doc(db, "challenges", id, "participants", userId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
