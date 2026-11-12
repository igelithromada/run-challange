import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";
import { cloudinaryPublicIdFromUrl, isUserCloudinaryPublicId } from "../../../lib/cloudinaryAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
    const body = await request.json().catch(() => ({}));

    const nickname = typeof body.nickname === "string"
      ? body.nickname.trim().replace(/\s+/g, " ")
      : "";
    const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : "";

    if (!nickname && !avatarUrl) {
      return NextResponse.json({ error: "Není co uložit." }, { status: 400 });
    }
    if (nickname && nickname.length > 40) {
      return NextResponse.json({ error: "Přezdívka může mít nejvýše 40 znaků." }, { status: 400 });
    }
    if (avatarUrl) {
      const publicId = cloudinaryPublicIdFromUrl(avatarUrl);
      if (
        !avatarUrl.startsWith("https://res.cloudinary.com/") ||
        !publicId ||
        !isUserCloudinaryPublicId(publicId, decoded.uid)
      ) {
        return NextResponse.json({ error: "Profilová fotografie má neplatný zdroj." }, { status: 400 });
      }
    }

    const userRef = adminDb.collection("users").doc(decoded.uid);
    const publicRef = adminDb.collection("publicProfiles").doc(decoded.uid);
    const [userSnapshot, publicSnapshot] = await Promise.all([userRef.get(), publicRef.get()]);

    const userData = userSnapshot.exists ? userSnapshot.data() || {} : {};
    const publicData = publicSnapshot.exists ? publicSnapshot.data() || {} : {};

    const userPatch: Record<string, string> = {};
    const publicPatch: Record<string, string> = {};
    if (nickname) {
      userPatch.nickname = nickname;
      publicPatch.nickname = nickname;
    }
    if (avatarUrl) {
      userPatch.avatarUrl = avatarUrl;
      publicPatch.avatarUrl = avatarUrl;
    }

    await Promise.all([
      userRef.set(userPatch, { merge: true }),
      publicRef.set({
        ...publicPatch,
        nickname: nickname || (typeof userData.nickname === "string" ? userData.nickname : (typeof publicData.nickname === "string" ? publicData.nickname : "")),
        avatarUrl: avatarUrl || (typeof userData.avatarUrl === "string" ? userData.avatarUrl : (typeof publicData.avatarUrl === "string" ? publicData.avatarUrl : "")),
        activityType: publicData.activityType === "chůze" ? "chůze" : "běh",
      }, { merge: true }),
    ]);

    return NextResponse.json({ ok: true, nickname: nickname || (typeof userData.nickname === "string" ? userData.nickname : ""), avatarUrl: avatarUrl || (typeof userData.avatarUrl === "string" ? userData.avatarUrl : "") });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("POST /api/settings/profile:", error);
    return NextResponse.json({ error: "Přezdívku se nepodařilo uložit." }, { status: 500 });
  }
}
