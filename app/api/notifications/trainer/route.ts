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
    if (!publicKey || !privateKey || !subject) throw new Error("VAPID not configured.");

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const { adminDb } = getAdminServices();
    const now = new Date();
    const local = dateParts(now);
    const currentTime = `${String(local.hour).padStart(2, "0")}:00`;
    const todayKey = dateKey(now);
    const tomorrowKey = addLocalDays(now, 1);
    const snapshot = await adminDb.collection("users").where("trainerNotifications.enabled", "==", true).get();

    let sent = 0;
    let failed = 0;
    let usersChecked = 0;

    const sendForUser = async (userDoc: FirebaseFirestore.DocumentSnapshot, data: UserData, targetKey: string, mode: "today" | "tomorrow") => {
      const prefs = data.trainerNotifications;
      if (!prefs) return;

      const enabled = mode === "today" ? prefs.today !== false : prefs.tomorrow !== false;
      const preferredTime = mode === "today" ? (prefs.todayTime || "07:00") : (prefs.tomorrowTime || "18:00");
      if (!enabled || preferredTime !== currentTime) return;

      const texts = ACTIVITY_TYPES
        .map(type => planFor(data, type, targetKey))
        .filter((plan): plan is TrainerPlan => plan !== null)
        .map(plan => plannedText(plan, targetKey))
        .filter(Boolean);
      if (!texts.length) return;

      const sentKey = `${mode}-${targetKey}-${preferredTime}`;
      if (prefs.lastSentKey === sentKey) return;

      const subscriptions = await userDoc.ref.collection("pushSubscriptions").get();
      let delivered = false;
      for (const subDoc of subscriptions.docs) {
        try {
          await webpush.sendNotification(
            subDoc.data() as webpush.PushSubscription,
            JSON.stringify({
              title: mode === "today" ? "Dnešní plán" : "Zítřejší plán",
              body: texts.join("  ·  "),
              tag: `trainer-${mode}-${targetKey}`,
              url: "/trainer",
            })
          );
          sent++;
          delivered = true;
        } catch (error) {
          failed++;
          const code = error instanceof webpush.WebPushError ? error.statusCode : 0;
          if (code === 404 || code === 410) await subDoc.ref.delete().catch(() => undefined);
        }
      }

      if (delivered) {
        await userDoc.ref.set({ trainerNotifications: { ...prefs, lastSentKey: sentKey } }, { merge: true });
      }
    };

    for (const userDoc of snapshot.docs) {
      usersChecked++;
      const data = { id: userDoc.id, ...userDoc.data() } as UserData;
      await sendForUser(userDoc, data, todayKey, "today");
      await sendForUser(userDoc, data, tomorrowKey, "tomorrow");
    }

    return NextResponse.json({
      ok: true,
      sent,
      failed,
      usersChecked,
      currentTime,
      today: todayKey,
      tomorrow: tomorrowKey,
    });
  } catch (error) {
    console.error("GET /api/notifications/trainer:", error);
    return NextResponse.json({ error: "Notifikace trenéra se nepodařilo odeslat." }, { status: 500 });
  }
}
