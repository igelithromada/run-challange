import { NextResponse } from "next/server";
import { getAdminServices } from "../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validType=(value:unknown): value is "běh"|"chůze" => value === "běh" || value === "chůze";

export async function POST(request: Request) {
  try {
    const { adminAuth, adminDb } = getAdminServices();
    const header = request.headers.get("authorization") || "";
    if (!header.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Nejsi přihlášen." }, { status: 401 });
    }

    const token = header.slice("Bearer ".length).trim();
    const decoded = await adminAuth.verifyIdToken(token);
    const body = await request.json().catch(() => ({}));
    const plan = body?.plan;

    if (!plan || typeof plan !== "object") {
      return NextResponse.json({ error: "Neplatný plán." }, { status: 400 });
    }

    const type = plan.type;
    const monthKey = plan.monthKey;
    const dates = Array.isArray(plan.dates) ? plan.dates.filter((x:unknown): x is string => typeof x === "string") : [];
    const rawDayKm = plan.dayKm && typeof plan.dayKm === "object" ? plan.dayKm as Record<string, unknown> : {};

    if (!validType(type) || typeof monthKey !== "string" || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return NextResponse.json({ error: "Plán obsahuje neplatné údaje." }, { status: 400 });
    }

    const safeDates: string[] = Array.from(new Set<string>(dates))
      .filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d.slice(0, 7) === monthKey)
      .sort();

    const dayKm: Record<string, number> = {};
    for (const date of safeDates) {
      const km = Number(rawDayKm[date]);
      if (!Number.isFinite(km) || km < 0.5 || km > 200) {
        return NextResponse.json({ error: "Plán obsahuje neplatný počet kilometrů." }, { status: 400 });
      }
      dayKm[date] = Math.round(km * 10) / 10;
    }

    const safePlan = {
      monthKey,
      type,
      dates: safeDates,
      dayKm,
      monthlyKm: safeDates.reduce((sum, date) => sum + dayKm[date], 0),
      createdAt: typeof plan.createdAt === "string" ? plan.createdAt : new Date().toISOString(),
    };

    const userRef = adminDb.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const existingPlans = userData.personalTrainerPlans && typeof userData.personalTrainerPlans === "object"
      ? userData.personalTrainerPlans
      : {};
    const typePlans = existingPlans[type] && typeof existingPlans[type] === "object" ? existingPlans[type] : {};
    const nextPlans = { ...existingPlans, [type]: { ...typePlans, [monthKey]: safePlan } };

    await userRef.set(
      { personalTrainerPlans: nextPlans, personalTrainerPlan: safePlan },
      { merge: true }
    );

    return NextResponse.json({ ok: true, plan: safePlan });
  } catch (error) {
    console.error("POST /api/trainer/plan:", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("auth") || message.includes("token")) {
      return NextResponse.json({ error: "Přihlášení už není platné. Obnov stránku a zkus to znovu." }, { status: 401 });
    }
    return NextResponse.json({ error: "Plán se nepodařilo uložit." }, { status: 500 });
  }
}
