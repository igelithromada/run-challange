import { auth, db } from "../firebase";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type Query,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type DocumentData,
  Timestamp,
} from "firebase/firestore";
import type { RunData } from "../../types";

export type NewRunData = Omit<RunData, "id">;

export const runsCollection = () => collection(db, "runs");

export function latestRunsQuery(pageSize = 30): Query<DocumentData, DocumentData> {
  return query(runsCollection(), orderBy("timestamp", "desc"), limit(pageSize));
}

export function filteredRunsQuery(startDate?: string, endDate?: string): Query<DocumentData, DocumentData> {
  const constraints: QueryConstraint[] = [orderBy("timestamp", "desc")];
  if (startDate) constraints.unshift(where("timestamp", ">=", Timestamp.fromDate(new Date(startDate + "T00:00:00"))));
  if (endDate) constraints.unshift(where("timestamp", "<=", Timestamp.fromDate(new Date(endDate + "T23:59:59.999"))));
  return query(runsCollection(), ...constraints);
}

/** Full personal history; chart/calendar sort locally and do not need a composite index. */
export function personalHistoryQuery(uid: string): Query<DocumentData, DocumentData> {
  return query(runsCollection(), where("uid", "==", uid));
}

export function userRunsQuery(uid: string): Query<DocumentData, DocumentData> {
  return query(runsCollection(), where("uid", "==", uid), orderBy("timestamp", "desc"));
}

export function olderRunsQuery(cursor: QueryDocumentSnapshot<DocumentData, DocumentData>, pageSize = 20): Query<DocumentData, DocumentData> {
  return query(runsCollection(), orderBy("timestamp", "desc"), startAfter(cursor), limit(pageSize));
}

export async function fetchRuns(runQuery: Query<DocumentData, DocumentData>): Promise<RunData[]> {
  const snapshot = await getDocs(runQuery);
  return snapshot.docs.map(mapRunSnapshot);
}

export async function createRun(data: NewRunData, submissionId?: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Nejsi přihlášen.");
  const token = await user.getIdToken(true);
  const response = await fetch("/api/runs/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ run: data, submissionId }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Záznam se nepodařilo uložit.");
  return String(result.id || "");
}

export async function updateRun(id: string, data: Partial<RunData>): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Nejsi přihlášen.");
  const token = await user.getIdToken(true);
  const response = await fetch("/api/runs/update", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id, updates: data }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Záznam se nepodařilo upravit.");
}

export async function fetchOlderRuns(
  cursor: QueryDocumentSnapshot<DocumentData, DocumentData>,
  pageSize = 20
): Promise<{ items: RunData[]; lastDocument: QueryDocumentSnapshot<DocumentData, DocumentData> | null }> {
  const snapshot = await getDocs(olderRunsQuery(cursor, pageSize));
  return {
    items: snapshot.docs.map(mapRunSnapshot),
    lastDocument: snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null,
  };
}

export function mapRunSnapshot(data: { id: string; data(): Record<string, unknown> }): RunData {
  return { ...data.data(), id: data.id } as RunData;
}

/** A notification may point outside the currently loaded feed page. */
export async function fetchRunById(id: string): Promise<RunData | null> {
  if (!id || id.includes("/")) throw new Error("Neplatné ID aktivity.");
  const snapshot = await getDoc(doc(db, "runs", id));
  return snapshot.exists() && snapshot.data().deleting !== true ? mapRunSnapshot(snapshot) : null;
}
