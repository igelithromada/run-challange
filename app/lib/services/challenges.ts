import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import type { ChallengeData } from "../../types";
import { readCommunity } from "./community";

type Page<T> = { items: T[]; lastDocument: QueryDocumentSnapshot<DocumentData, DocumentData> | null; hasMore: boolean };
export async function getChallenge(id: string): Promise<ChallengeData | null> {
  return readCommunity("challenge", id);
}
export async function getChallengeParticipants(id: string): Promise<any[]> {
  return (await readCommunity<any[] | null>("challengeParticipants", id)) || [];
}
export async function fetchChallengesPage(activityType: ChallengeData["activityType"], state: ChallengeData["state"], monthStart: string, monthEnd: string, pageSize = 10, cursor?: QueryDocumentSnapshot<DocumentData, DocumentData>): Promise<Page<ChallengeData>> {
  void pageSize; void cursor;
  const items = (await readCommunity<ChallengeData[]>("challenges"))
    .filter(item => !item.deleting && item.activityType === activityType && item.state === state && item.startDate <= monthEnd && item.endDate >= monthStart)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name, "cs") || a.id.localeCompare(b.id));
  return { items, lastDocument: null, hasMore: false };
}
function numericValue(value: any) {
  if (value && typeof value === "object") return Number(value.seconds ?? value._seconds ?? 0) * 1000 + Number(value.nanoseconds ?? value._nanoseconds ?? 0) / 1e6;
  return Number(value ?? 0);
}
export async function fetchChallengeParticipantsPage(id: string, challenge: Pick<ChallengeData, "state" | "kind">, pageSize = 10, cursor?: QueryDocumentSnapshot<DocumentData, DocumentData>): Promise<Page<any>> {
  void pageSize; void cursor;
  const items = await getChallengeParticipants(id);
  const field = challenge.state === "completed" ? "finalRank" : challenge.kind === "sharedDistance" ? "joinedAt" : "result";
  const direction = field === "result" ? -1 : 1;
  items.sort((a, b) => direction * (numericValue(a[field]) - numericValue(b[field])) || (field === "result" ? (numericValue(a.targetReachedAt) || Number.MAX_SAFE_INTEGER) - (numericValue(b.targetReachedAt) || Number.MAX_SAFE_INTEGER) : 0) || a.id.localeCompare(b.id));
  return { items, lastDocument: null, hasMore: false };
}
export async function getChallengeParticipant(id: string, userId: string): Promise<any> {
  void userId;
  return readCommunity("challengeMembership", id);
}
export async function getActiveChallengeIdsForUser(userId: string, challengeIds?: string[]): Promise<string[]> {
  const ids = challengeIds || (await readCommunity<ChallengeData[]>("challenges")).map(item => item.id);
  const memberships = await Promise.all(ids.map(id => getChallengeParticipant(id, userId)));
  return ids.filter((_, index) => memberships[index]?.active === true);
}
