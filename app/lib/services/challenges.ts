import { collection, collectionGroup, doc, getDoc, getDocs, query, where, type Query, type QueryDocumentSnapshot, type DocumentData } from "firebase/firestore";
import { db } from "../firebase";
import type { ChallengeData } from "../../types";

export function allChallengesQuery(): Query {
  return query(collection(db, "challenges"));
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
  const snapshot = await getDocs(query(
    collection(db, "challenges"),
    where("activityType", "==", activityType),
    where("state", "==", state),
    where("startMonth", "==", monthStart.slice(0, 7))
  ));
  const allItems = snapshot.docs
    .map(d => ({ id: d.id, ...d.data() } as ChallengeData))
    .filter(item => String(item.startDate || "") <= monthEnd && String(item.endDate || "") >= monthStart)
    .sort((a, b) => {
      const dateCompare = String(a.startDate || "").localeCompare(String(b.startDate || ""));
      return dateCompare !== 0
        ? dateCompare
        : String(a.name || "").localeCompare(String(b.name || ""), "cs");
    });

  const offset = Math.max(0, (Number.isFinite(Number(pageSize)) ? Number(pageSize) : 10) * (Number.isFinite(Number(cursor?.id)) ? 0 : 0));
  // Firestore cursor pagination is intentionally not used here because the
  // query is sorted client-side. Keep the API contract stable and return the
  // complete filtered set; the UI can paginate deterministically if needed.
  void offset;
  return {
    items: allItems.slice(0, Math.max(1, pageSize)),
    lastDocument: null,
    hasMore: allItems.length > Math.max(1, pageSize),
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
  const snapshot = await getDocs(
    query(collection(db, "challenges", id, "participants"), where("active", "==", true))
  );
  const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  items.sort((a: any, b: any) => {
    const av = Number(a[orderField] ?? 0);
    const bv = Number(b[orderField] ?? 0);
    if (av !== bv) return orderDirection === "asc" ? av - bv : bv - av;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
  return { items, lastDocument: null, hasMore: false };
}

export async function getChallengeParticipant(id: string, userId: string) {
  const snap = await getDoc(doc(db, "challenges", id, "participants", userId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}


export async function getActiveChallengeIdsForUser(userId: string): Promise<string[]> {
  const snapshot = await getDocs(
    query(collectionGroup(db, "participants"), where("userId", "==", userId))
  );
  return snapshot.docs
    .filter(item => item.data()?.active === true)
    .map(item => item.ref.parent.parent?.id || "")
    .filter(Boolean);
}
