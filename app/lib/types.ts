import type { Timestamp } from "firebase/firestore";

export type ActivityType = "běh" | "chůze";

export type Team = {
  id: string;
  name: string;
  type?: ActivityType;
  createdBy?: string;
  avatarUrl?: string;
  challengeGoalKm?: number | string;
  memberIds?: string[];
  createdAt?: Timestamp | Date | string;
};

export type UserProfile = {
  uid: string;
  nickname?: string;
  email?: string;
  avatarUrl?: string;
  activityType?: ActivityType;
  teamId?: string;
  teamIdsByType?: Partial<Record<ActivityType, string | null>>;
};
