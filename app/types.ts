import type { Timestamp } from "firebase/firestore";

export type ActivityType = "běh" | "chůze" | "dřepy" | "kliky";

export type FirestoreTimestamp = Timestamp | { seconds: number; nanoseconds?: number } | Date;

export interface OrganizationData { id:string; name:string; slug:string; logoUrl?:string; primaryColor?:string; secondaryColor?:string; municipality?:string; registrationCode?:string; active?:boolean; }

export interface RunData {
  id:string; uid:string; organizationId?:string; email?:string; nickname?:string; avatarUrl?:string; teamId?:string;
  repetitions?:number; activityType?:ActivityType; type?:string; km:number|string; minuty:number|string; tempo:number|string; description?:string;
  timestamp?:FirestoreTimestamp; imageUrl?:string; imageUrls?:string[]; imagePublicIds?:string[]; likedBy?:string[];
  likeCount?:number; commentCount?:number; comments?:RunComment[];
}
export interface RunComment { id:string; uid:string; text:string; nickname?:string; createdAt?:FirestoreTimestamp; updatedAt?:FirestoreTimestamp; }
export interface PublicProfileData { id:string; nickname?:string; avatarUrl?:string; activityType?:ActivityType; organizationId?:string; }

export interface UserData {
  id:string; organizationId?:string; nickname?:string; email?:string; avatarUrl?:string; theme?:string; customColor?:string;
  gradientEnabled?:boolean; themeUpdatedAt?:FirestoreTimestamp; role?:string; blocked?:boolean; activityType?:ActivityType;
  defaultActivity?:ActivityType; teamId?:string; teamIdsByType?:Partial<Record<ActivityType,string|null>>; challengeGoalKm?:number;
  hapticsEnabled?:boolean; socialNotifications?:{likes?:boolean;comments?:boolean;teams?:boolean;challenges?:boolean;chat?:boolean}; confirmDelete?:boolean;
  trainerNotifications?:{enabled?:boolean;today?:boolean;tomorrow?:boolean;todayTime?:string;tomorrowTime?:string;lastSentKey?:string;lastSentKeys?:Partial<Record<"today"|"tomorrow",string>>};
  progressGoals?:{type?:ActivityType;weekly?:number;monthly?:number};
  progressGoalsByType?:Partial<Record<ActivityType,{weekly?:number;monthly?:number}>>;
  personalTrainerPlan?:TrainerPlan|LegacyTrainerPlan;
  personalTrainerPlans?:Partial<Record<ActivityType,Record<string,TrainerPlan>>>;
}

export interface TeamStats { runningKm:number; runningActivities:number; walkingKm:number; walkingActivities:number; squatRepetitions?:number; squatActivities?:number; pushupRepetitions?:number; pushupActivities?:number; }
export interface TeamData {
  deleting?: boolean;
  id:string; organizationId?:string; name:string; description?:string; createdBy?:string; managerId?:string; type?:ActivityType; challengeGoalKm?:number;
  avatarUrl?:string; avatarPublicId?:string; memberCount?:number; stats?:TeamStats;
  memberIds?:string[]; // legacy compatibility only; new code should use members subcollection
}

export type ChallengeKind = "distance"|"activities"|"activeDays"|"sharedDistance"|"repetitions"|"sharedRepetitions";
export type ChallengeState = "planned"|"active"|"completed";

export interface ChallengeData {
  deleting?: boolean;
  id:string; organizationId?:string; name:string; description?:string; createdBy?:string; avatarUrl?:string;
  avatarPublicId?:string; kind:ChallengeKind; activityType:ActivityType; goal:number;
  startDate:string; endDate:string; state:ChallengeState; participantCount?:number;
  sharedProgress?:number; winnerId?:string; goalReached?:boolean; goalReachedAt?:FirestoreTimestamp;
}

export interface ChallengeParticipant {
  id:string; nickname?:string; avatarUrl?:string; joinedAt?:FirestoreTimestamp; leftAt?:FirestoreTimestamp;
  result?:number; targetReachedAt?:FirestoreTimestamp;
}

export interface TeamMember { id:string; nickname:string; email:string; avatarUrl:string; }
export interface AdminUser extends UserData { id:string; }

/** dayKm/monthlyKm are legacy storage names: values use the selected type’s unit. */
export interface TrainerPlan { monthKey:string; type:ActivityType; dates:string[]; dayKm:Record<string,number>; monthlyKm:number; createdAt?:FirestoreTimestamp; }
export interface LegacyTrainerPlan { weekKey?:string; type?:ActivityType; days?:number[]; dayKm?:Record<string,number>; weeklyKm?:number; }
