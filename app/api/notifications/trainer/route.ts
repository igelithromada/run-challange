import { NextResponse } from "next/server";
import webpush from "web-push";
import { getAdminServices } from "../../../lib/firebaseAdmin";
import type { ActivityType, TrainerPlan, UserData } from "../../../types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_ZONE = "Europe/Prague";
const ACTIVITY_TYPES: readonly ActivityType[] = ["běh", "chůze"];

function dateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: Number(get("hour")),
  };
}

function dateKey(date = new Date()) {
  const parts = dateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addLocalDays(date: Date, days: number) {
  const parts = dateParts(date);
  const local = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);
  local.setUTCDate(local.getUTCDate() + days);
  return dateKey(local);
}

function monthKeyFromDateKey(key: string) {
  return key.slice(0, 7);
}

function planFor(data: UserData, type: ActivityType, key: string): TrainerPlan | null {
  return data.personalTrainerPlans?.[type]?.[monthKeyFromDateKey(key)] ?? null;
}

function plannedText(plan: TrainerPlan, key: string) {
  const km = Number(plan.dayKm?.[key] || 0);
  if (!(km > 0)) return "";
  return `${plan.type === "chůze" ? "Chůze" : "Běh"} · ${km.toFixed(1)} km`;
}

export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET?.trim();
    const authHeader = request.headers.get("authorization") || "";
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
    const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
    const subject = process.env.VAPID_SUBJECT?.trim();
    if (!publicKey || !privateKey || !subject) {
      throw new Error("VAPID not configured.");
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const { adminDb } = getAdminServices();
    const now = new Date();
    const local = dateParts(now);
    const isToday = local.hour < 12;
    const targetKey = isToday ? dateKey(now) : addLocalDays(now, 1);
    const snapshot = await adminDb.collection("users").where("trainerNotifications.enabled", "==", true).get();

    let sent = 0;
    let failed = 0;

    for (const userDoc of snapshot.docs) {
      const data = { id: userDoc.id, ...userDoc.data() } as UserData;
      const prefs = data.trainerNotifications;
      if (isToday ? prefs.today !== true : prefs.tomorrow !== true) continue;

      const texts = ACTIVITY_TYPES
        .map(type => planFor(data, type, targetKey))
        .filter((plan): plan is TrainerPlan => plan !== null)
        .map(plan => plannedText(plan, targetKey))
        .filter(Boolean);

      if (!texts.length) continue;

      const subscriptions = await userDoc.ref.collection("pushSubscriptions").get();
      for (const subDoc of subscriptions.docs) {
        try {
          await webpush.sendNotification(
            subDoc.data() as webpush.PushSubscription,
            JSON.stringify({
              title: isToday ? "Dnešní plán" : "Zítřejší plán",
              body: texts.join("  ·  "),
              tag: `trainer-${isToday ? "today" : "tomorrow"}-${targetKey}`,
              url: "/trainer",
            })
          );
          sent++;
        } catch (error) {
          failed++;
          const code = error instanceof webpush.WebPushError ? error.statusCode : 0;
          if (code === 404 || code === 410) {
            await subDoc.ref.delete().catch(() => undefined);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      sent,
      failed,
      target: targetKey,
      mode: isToday ? "today" : "tomorrow",
    });
  } catch (error) {
    console.error("GET /api/notifications/trainer:", error);
    return NextResponse.json({ error: "Notifikace trenéra se nepodařilo odeslat." }, { status: 500 });
  }
}
