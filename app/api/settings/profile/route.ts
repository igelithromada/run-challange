import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
    const body = await request.json().catch(() => ({}));

    const nickname = typeof body.nickname === "string"
      ? body.nickname.trim().replace(/\s+/g, " ")
      : "";

    if (!nickname) {
      return NextResponse.json({ error: "Přezdívka nesmí být prázdná." }, { status: 400 });
    }
    if (nickname.length > 40) {
      return NextResponse.json({ error: "Přezdívka může mít nejvýše 40 znaků." }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(decoded.uid);
    const publicRef = adminDb.collection("publicProfiles").doc(decoded.uid);
    const [userSnapshot, publicSnapshot] = await Promise.all([userRef.get(), publicRef.get()]);

    const userData = userSnapshot.exists ? userSnapshot.data() || {} : {};
    const publicData = publicSnapshot.exists ? publicSnapshot.data() || {} : {};

    await Promise.all([
      userRef.set({ nickname }, { merge: true }),
      publicRef.set({
        nickname,
        avatarUrl: typeof userData.avatarUrl === "string" ? userData.avatarUrl : (typeof publicData.avatarUrl === "string" ? publicData.avatarUrl : ""),
        activityType: publicData.activityType === "chůze" ? "chůze" : "běh",
      }, { merge: true }),
    ]);

    return NextResponse.json({ ok: true, nickname });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("POST /api/settings/profile:", error);
    return NextResponse.json({ error: "Přezdívku se nepodařilo uložit." }, { status: 500 });
  }
}
