import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type Query,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import type { RunData } from "../../types";

export type NewRunData = Omit<RunData, "id">;

export const runsCollection = () => collection(db, "runs");

export function latestRunsQuery(pageSize = 30): Query {
  return query(runsCollection(), orderBy("timestamp", "desc"), limit(pageSize));
}

export function filteredRunsQuery(startDate?: string, endDate?: string): Query {
  const constraints: QueryConstraint[] = [orderBy("timestamp", "desc")];
  if (startDate) constraints.unshift(where("timestamp", ">=", Timestamp.fromDate(new Date(startDate + "T00:00:00"))));
  if (endDate) constraints.unshift(where("timestamp", "<=", Timestamp.fromDate(new Date(endDate + "T23:59:59.999"))));
  return query(runsCollection(), ...constraints);
}

export function userRunsQuery(uid: string): Query {
  return query(runsCollection(), where("uid", "==", uid), orderBy("timestamp", "desc"));
}

export function latestUserRunsQuery(uid: string, pageSize = 30): Query {
  return query(runsCollection(), where("uid", "==", uid), orderBy("timestamp", "desc"), limit(pageSize));
}

export function userRunsForDateRangeQuery(uid: string, start: Date, end: Date): Query {
  return query(
    runsCollection(),
    where("uid", "==", uid),
    where("timestamp", ">=", Timestamp.fromDate(start)),
    where("timestamp", "<=", Timestamp.fromDate(end)),
    orderBy("timestamp", "desc"),
  );
}

export function teamRunsQuery(teamId: string): Query {
  return query(runsCollection(), where("teamId", "==", teamId));
}

export function olderRunsQuery(cursor: QueryDocumentSnapshot, pageSize = 20): Query {
  return query(runsCollection(), orderBy("timestamp", "desc"), startAfter(cursor), limit(pageSize));
}

export async function fetchRuns(runQuery: Query): Promise<RunData[]> {
  const snapshot = await getDocs(runQuery);
  return snapshot.docs.map(mapRunSnapshot);
}

export async function fetchAllRuns(pageSize = 500): Promise<RunData[]> {
  const items: RunData[] = [];
  let cursor: QueryDocumentSnapshot | null = null;

  while (true) {
    const nextQuery: Query = cursor
      ? olderRunsQuery(cursor, pageSize)
      : latestRunsQuery(pageSize);
    const snapshot: Awaited<ReturnType<typeof getDocs>> = await getDocs(nextQuery);
    if (!snapshot.docs.length) break;

    items.push(...snapshot.docs.map(mapRunSnapshot));
    cursor = snapshot.docs[snapshot.docs.length - 1];

    if (snapshot.docs.length < pageSize) break;
  }

  return items;
}

export async function createRun(data: NewRunData): Promise<string> {
  const snapshot = await addDoc(runsCollection(), data);
  return snapshot.id;
}

export async function updateRun(id: string, data: Partial<RunData>): Promise<void> {
  await updateDoc(doc(db, "runs", id), data);
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
