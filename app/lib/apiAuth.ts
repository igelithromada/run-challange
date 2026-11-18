import type { DecodedIdToken } from "firebase-admin/auth";
import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore";
import { getAdminServices } from "./firebaseAdmin";

export class ApiAuthError extends Error {
  constructor(public readonly code: "UNAUTHORIZED" | "FORBIDDEN" | "BLOCKED" | "DELETING") {
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

export async function requireUser(request: Request, options: { allowBlocked?: boolean } = {}): Promise<{
  decoded: DecodedIdToken;
  adminDb: Firestore;
  profile?: DocumentSnapshot;
}> {
  const { adminAuth, adminDb } = getAdminServices();
  const decoded = await adminAuth.verifyIdToken(bearerToken(request), true);
  const profile = options.allowBlocked ? undefined : await adminDb.collection("users").doc(decoded.uid).get();
  if (profile) {
    if (profile.data()?.deleting === true) throw new ApiAuthError("DELETING");
    if (profile.data()?.blocked === true) throw new ApiAuthError("BLOCKED");
  }
  return { decoded, adminDb, profile };
}

export async function requireAdmin(request: Request): Promise<{
  decoded: DecodedIdToken;
  adminDb: Firestore;
}> {
  const { decoded, adminDb } = await requireUser(request, { allowBlocked: true });
  const profile = await adminDb.collection("users").doc(decoded.uid).get();
  if (profile.data()?.role !== "admin" && decoded.admin !== true) {
    throw new ApiAuthError("FORBIDDEN");
  }
  return { decoded, adminDb };
}

function isFirebaseAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  return code.startsWith("auth/");
}

export function authErrorResponse(error: unknown): { status: number; message: string } | null {
  if (error instanceof ApiAuthError) {
    return {
      status: error.code === "FORBIDDEN" || error.code === "BLOCKED" || error.code === "DELETING" ? 403 : 401,
      message: error.code === "DELETING" ? "Účet se právě maže. Zkus dokončit smazání znovu." : error.code === "BLOCKED" ? "Tento účet je zablokovaný." : error.code === "FORBIDDEN" ? "Nemáš oprávnění správce." : "Nejsi přihlášen.",
    };
  }

  if (isFirebaseAuthError(error)) {
    return { status: 401, message: "Přihlášení vypršelo nebo není platné." };
  }

  return null;
}
