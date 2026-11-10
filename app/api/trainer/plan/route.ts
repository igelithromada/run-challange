
import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validType = (value: unknown): value is "běh" | "chůze" => value === "běh" || value === "chůze";

export async function POST(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const plan = body?.plan;
    if (!plan || typeof plan !== "object") return NextResponse.json({ error: "Neplatný plán." }, { status: 400 });

    const type = plan.type;
    const monthKey = plan.monthKey;
    const dates = Array.isArray(plan.dates) ? plan.dates.filter((x: unknown): x is string => typeof x === "string") : [];
    const rawDayKm = plan.dayKm && typeof plan.dayKm === "object" ? plan.dayKm as Record<string, unknown> : {};
    if (!validType(type) || typeof monthKey !== "string" || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return NextResponse.json({ error: "Plán obsahuje neplatné údaje." }, { status: 400 });
    }

    const safeDates = Array.from(new Set(dates)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d.slice(0, 7) === monthKey).sort();
    const dayKm: Record<string, number> = {};
    for (const date of safeDates) {
      const km = Number(rawDayKm[date]);
      if (!Number.isFinite(km) || km < 0.5 || km > 200) return NextResponse.json({ error: "Plán obsahuje neplatný počet kilometrů." }, { status: 400 });
      dayKm[date] = Math.round(km * 10) / 10;
    }

    const safePlan = {
      monthKey, type, dates: safeDates, dayKm,
      monthlyKm: safeDates.reduce((sum, date) => sum + dayKm[date], 0),
      createdAt: typeof plan.createdAt === "string" ? plan.createdAt : new Date().toISOString(),
    };

    const userRef = adminDb.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const existingPlans = (userData.personalTrainerPlans && typeof userData.personalTrainerPlans === "object" ? userData.personalTrainerPlans : {}) as Record<"běh" | "chůze", Record<string, Record<string, unknown>>>;
    const typePlans = existingPlans[type] && typeof existingPlans[type] === "object" ? existingPlans[type] : {};
    await userRef.set(
      { personalTrainerPlans: { ...existingPlans, [type]: { ...typePlans, [monthKey]: safePlan } }, personalTrainerPlan: safePlan },
      { merge: true }
    );
    return NextResponse.json({ ok: true, plan: safePlan });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("POST /api/trainer/plan:", error);
    return NextResponse.json({ error: "Plán se nepodařilo uložit." }, { status: 500 });
  }
}
