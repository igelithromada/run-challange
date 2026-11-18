export const FIRESTORE_LIMITS = { reads: 50_000, writes: 20_000, deletes: 20_000 } as const;
export const CLOUDINARY_FREE_CREDITS = 25;

export type ServiceUsage = {
  checkedAt: string;
  firestore: {
    since: string;
    reads: number | null;
    writes: number | null;
    deletes: number | null;
  } | null;
  cloudinary: {
    credits: number | null;
    limit: number;
    storage: number | null;
    bandwidth: number | null;
  } | null;
};
