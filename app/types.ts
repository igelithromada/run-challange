import type { Timestamp } from "firebase/firestore";

export type ActivityType = "běh" | "chůze";

export type FirestoreTimestamp = Timestamp | {
  seconds: number;
  nanoseconds?: number;
} | Date;

export interface RunData {
  id: string;
  uid: string;
  email?: string;
  nickname?: string;
  avatarUrl?: string;
  teamId?: string;
  activityType?: ActivityType;
  type?: string;
  km: number | string;
  minuty: number | string;
  tempo: number | string;
  description?: string;
  timestamp?: FirestoreTimestamp;
  imageUrl?: string;
  imageUrls?: string[];
  imagePublicIds?: string[];
  likedBy?: string[];
  likeCount?: number;
  commentCount?: number;
  comments?: RunComment[];
}

export interface RunComment {
  id: string;
  uid: string;
  text: string;
  nickname?: string;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

export interface UserData {
  id: string;
  nickname?: string;
  email?: string;
  avatarUrl?: string;
  theme?: string;
  customColor?: string;
  role?: string;
  blocked?: boolean;
  activityType?: ActivityType;
  defaultActivity?: ActivityType;
  teamId?: string;
  teamIdsByType?: Partial<Record<ActivityType, string | null>>;
  challengeGoalKm?: number;
  hapticsEnabled?: boolean;
  confirmDelete?: boolean;
  trainerNotifications?: {
    enabled?: boolean;
    today?: boolean;
    tomorrow?: boolean;
  };
  progressGoals?: {
    type?: ActivityType;
    monthly?: number;
  };
  progressGoalsByType?: Partial<Record<ActivityType, { monthly?: number }>>;
}

export interface TeamData {
  id: string;
  name: string;
  type?: ActivityType;
  challengeGoalKm?: number;
  createdBy?: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  memberIds?: string[];
}

export interface TeamMember {
  id: string;
  nickname: string;
  email: string;
  avatarUrl: string;
}

export interface AdminUser extends UserData {
  id: string;
}

export interface TrainerPlan {
  monthKey: string;
  type: ActivityType;
  dates: string[];
  dayKm: Record<string, number>;
  monthlyKm: number;
  createdAt?: FirestoreTimestamp;
}

export interface LegacyTrainerPlan {
  weekKey?: string;
  type?: ActivityType;
  days?: number[];
  dayKm?: Record<string, number>;
  weeklyKm?: number;
}
