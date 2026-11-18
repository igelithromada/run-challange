import { sharedChallenge } from "../challengeMeasurement";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import type { ChallengeData, ChallengeList } from "../../types";
import { readCommunity } from "./community";

type Page<T> = { items: T[]; lastDocument: QueryDocumentSnapshot<DocumentData, DocumentData> | null; hasMore: boolean };
export async function getChallenge(id: string): Promise<ChallengeData | null> {
  return readCommunity("challenge", id);
}
export async function getChallengeParticipants(id: string): Promise<any[]> {
  return (await readCommunity<any[] | null>("challengeParticipants", id)) || [];
}
export function fetchChallengeList(
  activityType: ChallengeData["activityType"],
  state: ChallengeData["state"],
  monthStart: string,
  monthEnd: string,
  signal: AbortSignal,
): Promise<ChallengeList> {
  return readCommunity("challengeList", undefined, {
    filters: { activityType, state, monthStart, monthEnd },
    signal,
  });
}

function numericValue(value: any) {
  if (value && typeof value === "object") return Number(value.seconds ?? value._seconds ?? 0) * 1000 + Number(value.nanoseconds ?? value._nanoseconds ?? 0) / 1e6;
  return Number(value ?? 0);
}
export async function fetchChallengeParticipantsPage(id: string, challenge: Pick<ChallengeData, "state" | "kind">, pageSize = 10, cursor?: QueryDocumentSnapshot<DocumentData, DocumentData>): Promise<Page<any>> {
  void pageSize; void cursor;
  const items = await getChallengeParticipants(id);
  const field = challenge.state === "completed" ? "finalRank" : sharedChallenge(challenge.kind) ? "joinedAt" : "result";
  const direction = field === "result" ? -1 : 1;
  items.sort((a, b) => direction * (numericValue(a[field]) - numericValue(b[field])) || (field === "result" ? (numericValue(a.targetReachedAt) || Number.MAX_SAFE_INTEGER) - (numericValue(b.targetReachedAt) || Number.MAX_SAFE_INTEGER) : 0) || a.id.localeCompare(b.id));
  return { items, lastDocument: null, hasMore: false };
}
export async function getChallengeParticipant(id: string, userId: string): Promise<any> {
  void userId;
  return readCommunity("challengeMembership", id);
}
