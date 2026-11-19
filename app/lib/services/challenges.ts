import type { ChallengeData, ChallengeList, ChallengeParticipant } from "../../types";
import { readCommunity } from "./community";

export function getChallenge(id: string, signal?: AbortSignal): Promise<ChallengeData | null> {
  return readCommunity("challenge", id, signal ? { signal } : undefined);
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

function reachedAt(value: unknown): number {
  if (!value || typeof value !== "object") return Infinity;
  const time = value as { seconds?: number; _seconds?: number; nanoseconds?: number; _nanoseconds?: number };
  const seconds = time.seconds ?? time._seconds;
  return seconds === undefined ? Infinity : seconds * 1000 + (time.nanoseconds ?? time._nanoseconds ?? 0) / 1e6;
}

export async function getRankedChallengeParticipants(id: string, completed: boolean, signal: AbortSignal) {
  const items = await readCommunity<ChallengeParticipant[] | null>("challengeParticipants", id, { signal }) ?? [];
  return items.sort((a, b) => {
    if (completed) {
      const rankDifference = (a.finalRank || Infinity) - (b.finalRank || Infinity);
      if (rankDifference) return rankDifference;
    }
    const aResult = (completed ? a.finalResult ?? a.result : a.result) ?? 0;
    const bResult = (completed ? b.finalResult ?? b.result : b.result) ?? 0;
    return bResult - aResult || reachedAt(a.targetReachedAt) - reachedAt(b.targetReachedAt) || a.id.localeCompare(b.id);
  });
}

export function getChallengeParticipant(id: string, signal: AbortSignal): Promise<ChallengeParticipant | null> {
  return readCommunity("challengeMembership", id, { signal });
}
