import type { DecodedIdToken } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { getAdminServices } from "./firebaseAdmin";

export class ApiAuthError extends Error {
  constructor(public readonly code: "UNAUTHORIZED" | "FORBIDDEN") {
    super(code);
  }
}

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) throw new ApiAuthError("UNAUTHORIZED");
  const token = header.slice(7).trim();
  if (!token) throw new ApiAuthError("UNAUTHORIZED");
  return token;
}

export async function requireUser(request: Request): Promise<{
  decoded: DecodedIdToken;
  adminDb: Firestore;
}> {
  const { adminAuth, adminDb } = getAdminServices();
  const decoded = await adminAuth.verifyIdToken(bearerToken(request));
  return { decoded, adminDb };
}

export async function requireAdmin(request: Request): Promise<{
  decoded: DecodedIdToken;
  adminDb: Firestore;
}> {
  const { decoded, adminDb } = await requireUser(request);
  const profile = await adminDb.collection("users").doc(decoded.uid).get();
  if (profile.data()?.role !== "admin" && decoded.admin !== true) {
    throw new ApiAuthError("FORBIDDEN");
  }
  return { decoded, adminDb };
}

export function authErrorResponse(error: unknown): { status: number; message: string } | null {
  if (!(error instanceof ApiAuthError)) return null;
  return {
    status: error.code === "FORBIDDEN" ? 403 : 401,
    message: error.code === "FORBIDDEN" ? "Nemáš oprávnění správce." : "Nejsi přihlášen.",
  };
}
