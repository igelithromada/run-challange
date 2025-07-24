export interface RunData {
  id: string;
  uid: string;
  km: number;
  minuty: number;
  tempo: number;
  timestamp?: { seconds: number; nanoseconds: number };
  imageUrl?: string;
  nickname?: string;
  email?: string;
  type?: string;
}
