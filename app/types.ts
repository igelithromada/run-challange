// app/types.ts

export interface RunData {
  id: string;
  uid: string;
  email?: string;
  nickname?: string;
  teamId?: string;
  km: number;
  minuty: string;
  tempo: string;
  type?: string;
  timestamp: {
    seconds: number;
    nanoseconds?: number;
  };
  imageUrl?: string;
  imageUrls?: string[];
}

export interface UserData {
  id: string;
  nickname?: string;
  email?: string;
  avatarUrl?: string;
  theme?: string;
  customColor?: string;
}

export interface TeamData {
  id: string;
  name: string;
}
