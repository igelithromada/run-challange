import crypto from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";

const WINDOW_MS = 15 * 60 * 1000;

function clientKey(request: Request, scope: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  const ip = forwarded || real || "unknown";
  return crypto.createHash("sha256").update(`${scope}:${ip}`).digest("hex");
}

export async function consumeRateLimit(
  adminDb: Firestore,
  request: Request,
  scope: string,
  limit: number
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const id = clientKey(request, scope);
  const ref = adminDb.collection("rateLimits").doc(id);
  const now = Date.now();

  const result = await adminDb.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? snapshot.data() || {} : {};
    const windowStart = typeof current.windowStart === "number" ? current.windowStart : 0;
    const count = typeof current.count === "number" ? current.count : 0;

    if (now - windowStart >= WINDOW_MS) {
      transaction.set(ref, { windowStart: now, count: 1 }, { merge: true });
      return { allowed: true, retryAfterSeconds: Math.ceil(WINDOW_MS / 1000) };
    }

    if (count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - windowStart)) / 1000)),
      };
    }

    transaction.set(ref, { windowStart, count: count + 1 }, { merge: true });
    return { allowed: true, retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - windowStart)) / 1000)) };
  });

  return result;
}
