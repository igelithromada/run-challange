import {
  collection,
  getDocs,
  updateDoc,
  addDoc,
  doc,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import type { RunData } from "../../types";

export type RunUpdate = Partial<Omit<RunData, "id">>;
export type NewRunData = Omit<RunData, "id">;

export const runsCollection = () => collection(db, "runs");

export function latestRunsQuery(pageSize = 30): Query {
  return query(runsCollection(), orderBy("timestamp", "desc"), limit(pageSize));
}

export function userRunsQuery(uid: string): Query {
  return query(runsCollection(), where("uid", "==", uid), orderBy("timestamp", "desc"));
}

export function teamRunsQuery(teamId: string): Query {
  return query(runsCollection(), where("teamId", "==", teamId));
}

export function olderRunsQuery(cursor: QueryDocumentSnapshot, pageSize = 20): Query {
  return query(runsCollection(), orderBy("timestamp", "desc"), startAfter(cursor), limit(pageSize));
}

export async function createRun(data: NewRunData): Promise<string> {
  const snapshot = await addDoc(runsCollection(), data);
  return snapshot.id;
}

export async function updateRun(runId: string, data: RunUpdate): Promise<void> {
  await updateDoc(doc(db, "runs", runId), data);
}

export async function fetchOlderRuns(
  cursor: QueryDocumentSnapshot,
  pageSize = 20
): Promise<{ items: RunData[]; lastDocument: QueryDocumentSnapshot | null }> {
  const snapshot = await getDocs(olderRunsQuery(cursor, pageSize));
  return {
    items: snapshot.docs.map(mapRunSnapshot),
    lastDocument: snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null,
  };
}

export function mapRunSnapshot(data: { id: string; data(): Record<string, unknown> }): RunData {
  return { id: data.id, ...data.data() } as RunData;
}
