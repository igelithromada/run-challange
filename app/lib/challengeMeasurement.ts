import type { ActivityType, ChallengeKind } from "../types";
import { isStrengthActivity } from "./activity";
export const sharedChallenge = (kind: string) => kind === "sharedDistance" || kind === "sharedRepetitions";
export const quantityChallenge = (kind:string) => sharedChallenge(kind) || kind === "distance" || kind === "repetitions";
export function challengeKindFor(type:ActivityType, kind:ChallengeKind):ChallengeKind {
 if(kind === "activities" || kind === "activeDays") return kind;
 return sharedChallenge(kind) ? (isStrengthActivity(type) ? "sharedRepetitions" : "sharedDistance") : (isStrengthActivity(type) ? "repetitions" : "distance");
}
export const challengeUnit = (kind:string) => kind === "repetitions" || kind === "sharedRepetitions" ? "opakování" : quantityChallenge(kind) ? "km" : kind === "activities" ? "aktivit" : "dnů";
