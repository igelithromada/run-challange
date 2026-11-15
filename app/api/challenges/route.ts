import { NextResponse } from "next/server";
import { FieldValue, Timestamp, type Firestore, type DocumentReference } from "firebase-admin/firestore";
import { requireUser } from "../../lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChallengeType = "distance" | "activeDays" | "activities" | "target";
type Scope = "individual" | "team";

const TYPES = new Set<ChallengeType>(["distance", "activeDays", "activities", "target"]);
const SCOPES = new Set<Scope>(["individual", "team"]);

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

function asDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function materializeChallenge(adminDb: Firestore, ref: DocumentReference) {
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const now = new Date();
  const start = data.startAt?.toDate?.() || new Date(data.startAt || 0);
  const end = data.endAt?.toDate?.() || new Date(data.endAt || 0);
  let status = now < start ? "upcoming" : now <= end ? "active" : "finished";

  const storedSnapshots = data.participantSnapshots && typeof data.participantSnapshots === "object"
    ? data.participantSnapshots as Record<string, unknown>
    : {};
  const needsSnapshot = now >= start && !data.snapshotAt;

  if (needsSnapshot) {
    const updates: Record<string, unknown> = {
      snapshotAt: Timestamp.fromDate(now),
      status,
    };

    if (data.scope === "individual") {
      updates.participantSnapshots = Object.fromEntries(
        (Array.isArray(data.participantIds) ? data.participantIds : []).map((id: unknown) => [String(id), [String(id)]])
      );
    } else {
      const teamIds = Array.isArray(data.teamIds) ? data.teamIds.filter((id: unknown): id is string => typeof id === "string") : [];
      const snapshots: Record<string, string[]> = {};
      for (const teamId of teamIds) {
        const teamSnap = await adminDb.collection("teams").doc(teamId).get();
        const memberIds = Array.isArray(teamSnap.data()?.memberIds)
          ? (teamSnap.data()?.memberIds as unknown[]).filter((id): id is string => typeof id === "string")
          : [];
        snapshots[teamId] = memberIds;
      }
      updates.participantSnapshots = snapshots;
    }
    await ref.set(updates, { merge: true });
    Object.assign(data, updates);
  }

  const participantSnapshots = data.participantSnapshots && typeof data.participantSnapshots === "object"
    ? data.participantSnapshots as Record<string, unknown>
    : storedSnapshots;

  return {
    id: ref.id,
    ...data,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    status,
    participantSnapshots,
  };
}

async function calculateResults(adminDb: FirebaseFirestore.Firestore, challenge: any) {
  const start = Timestamp.fromDate(new Date(challenge.startAt));
  const end = Timestamp.fromDate(new Date(challenge.endAt));
  const runsSnap = await adminDb.collection("runs")
    .where("timestamp", ">=", start)
    .where("timestamp", "<=", end)
    .limit(5000)
    .get();

  const snapshots = challenge.participantSnapshots || {};
  const aggregate = new Map<string, { km: number; days: Set<string>; activities: number }>();

  const allowedUsers = new Set<string>();
  const teamMembers = new Map<string, string[]>();
  if (challenge.scope === "individual") {
    Object.keys(snapshots).forEach(id => allowedUsers.add(id));
  } else {
    for (const [teamId, ids] of Object.entries(snapshots)) {
      const members = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
      teamMembers.set(teamId, members);
      members.forEach(id => allowedUsers.add(id));
    }
  }

  for (const doc of runsSnap.docs) {
    const run = doc.data();
    const uid = typeof run.uid === "string" ? run.uid : "";
    const activityType = run.type === "chůze" ? "chůze" : "běh";
    if (!uid || !allowedUsers.has(uid)) continue;
    if (challenge.activityType && activityType !== challenge.activityType) continue;
    const km = Number(run.km);
    if (!Number.isFinite(km) || km < 0) continue;

    const current = aggregate.get(uid) || { km: 0, days: new Set<string>(), activities: 0 };
    current.km += km;
    current.activities += 1;
    const ts = run.timestamp?.toDate?.() || new Date(run.timestamp || 0);
    if (Number.isFinite(ts.getTime())) current.days.add(ts.toISOString().slice(0, 10));
    aggregate.set(uid, current);
  }

  const individual = Array.from(allowedUsers).map(uid => {
    const value = aggregate.get(uid) || { km: 0, days: new Set<string>(), activities: 0 };
    const score = challenge.type === "distance" ? value.km
      : challenge.type === "activeDays" ? value.days.size
      : challenge.type === "activities" ? value.activities
      : value.km;
    return { uid, km: Number(value.km.toFixed(2)), activeDays: value.days.size, activities: value.activities, score: typeof score === "number" ? Number(score.toFixed(2)) : Number(score), completed: challenge.type === "target" ? value.km >= Number(challenge.targetValue || 0) : false };
  }).sort((a, b) => b.score - a.score);

  if (challenge.scope === "individual") return individual.map((row, i) => ({ ...row, rank: i + 1 }));

  const teams = Array.from(teamMembers.entries()).map(([teamId, members]) => {
    const rows = individual.filter(row => members.includes(row.uid));
    const active = rows.filter(row => row.activities > 0);
    const denominator = active.length || 1;
    const totalKm = rows.reduce((s, r) => s + r.km, 0);
    const totalDays = rows.reduce((s, r) => s + r.activeDays, 0);
    const totalActivities = rows.reduce((s, r) => s + r.activities, 0);
    const score = challenge.type === "distance" ? totalKm / denominator
      : challenge.type === "activeDays" ? totalDays / denominator
      : challenge.type === "activities" ? totalActivities / denominator
      : totalKm / denominator;
    return {
      teamId,
      participants: members.length,
      activeParticipants: active.length,
      km: Number(totalKm.toFixed(2)),
      activeDays: totalDays,
      activities: totalActivities,
      score: Number(score.toFixed(2)),
      completed: challenge.type === "target" ? totalKm >= Number(challenge.targetValue || 0) : false,
    };
  }).sort((a, b) => b.score - a.score);

  return teams.map((row, i) => ({ ...row, rank: i + 1 }));
}

export async function GET(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const result = await materializeChallenge(adminDb, adminDb.collection("challenges").doc(id));
      if (!result) return json({ error: "Výzva neexistuje." }, 404);
      const results = result.snapshotAt ? await calculateResults(adminDb, result) : [];
      return json({ challenge: result, results });
    }

    const snap = await adminDb.collection("challenges").orderBy("startAt", "desc").limit(100).get();
    const challenges = [];
    for (const doc of snap.docs) {
      const challenge = await materializeChallenge(adminDb, doc.ref);
      if (challenge) challenges.push(challenge);
    }
    return json({ challenges, uid: decoded.uid });
  } catch (error) {
    console.error("GET /api/challenges:", error);
    return json({ error: "Výzvy se nepodařilo načíst." }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const action = cleanText(body?.action, 30);

    if (action === "create") {
      const title = cleanText(body?.title, 80);
      const description = cleanText(body?.description, 500);
      const type = cleanText(body?.type, 30) as ChallengeType;
      const scope = cleanText(body?.scope, 20) as Scope;
      const activityType = body?.activityType === "chůze" ? "chůze" : "běh";
      const startAt = asDate(body?.startAt);
      const endAt = asDate(body?.endAt);
      const targetValue = Number(body?.targetValue || 0);

      if (!title || !TYPES.has(type) || !SCOPES.has(scope) || !startAt || !endAt || endAt <= startAt) {
        return json({ error: "Vyplň název, typ, rozsah a platné období výzvy." }, 400);
      }
      if (startAt.getTime() < Date.now() - 5 * 60_000) return json({ error: "Začátek výzvy nemůže být v minulosti." }, 400);
      if (endAt.getTime() - startAt.getTime() > 366 * 86400000) return json({ error: "Výzva může trvat nejvýše 366 dní." }, 400);
      if (type === "target" && (!Number.isFinite(targetValue) || targetValue <= 0 || targetValue > 100000)) {
        return json({ error: "Pro tento typ zadej platný cílový počet kilometrů." }, 400);
      }

      const data: Record<string, unknown> = {
        title, description, type, scope, activityType,
        startAt: Timestamp.fromDate(startAt),
        endAt: Timestamp.fromDate(endAt),
        createdBy: decoded.uid,
        createdAt: FieldValue.serverTimestamp(),
        participantIds: scope === "individual" ? [decoded.uid] : [],
        teamIds: [],
        participantSnapshots: {},
        status: "upcoming",
      };

      if (scope === "team") {
        const teamId = cleanText(body?.teamId, 100);
        if (!teamId) return json({ error: "Vyber tým pro týmovou výzvu." }, 400);
        const teamSnap = await adminDb.collection("teams").doc(teamId).get();
        const members = Array.isArray(teamSnap.data()?.memberIds) ? teamSnap.data()?.memberIds : [];
        if (!teamSnap.exists || !members.includes(decoded.uid)) return json({ error: "Týmovou výzvu můžeš vytvořit jen ve svém týmu." }, 403);
        data.teamIds = [teamId];
      }

      const ref = adminDb.collection("challenges").doc();
      await ref.set(data);
      return json({ ok: true, id: ref.id }, 201);
    }

    const challengeId = cleanText(body?.challengeId, 100);
    if (!challengeId) return json({ error: "Chybí výzva." }, 400);
    const ref = adminDb.collection("challenges").doc(challengeId);

    if (action === "join") {
      const snap = await ref.get();
      if (!snap.exists) return json({ error: "Výzva neexistuje." }, 404);
      const challenge = snap.data() || {};
      const now = new Date();
      const start = challenge.startAt?.toDate?.() || new Date(challenge.startAt || 0);
      if (now >= start) return json({ error: "Do výzvy už se po jejím začátku nelze přihlásit." }, 409);

      if (challenge.scope === "individual") {
        await ref.update({ participantIds: FieldValue.arrayUnion(decoded.uid) });
      } else {
        const teamId = cleanText(body?.teamId, 100);
        if (!teamId) return json({ error: "Vyber tým." }, 400);
        const teamSnap = await adminDb.collection("teams").doc(teamId).get();
        const members = Array.isArray(teamSnap.data()?.memberIds) ? teamSnap.data()?.memberIds : [];
        if (!members.includes(decoded.uid)) return json({ error: "Nejsi členem tohoto týmu." }, 403);
        await ref.update({ teamIds: FieldValue.arrayUnion(teamId) });
      }
      return json({ ok: true });
    }

    if (action === "leave") {
      const snap = await ref.get();
      if (!snap.exists) return json({ error: "Výzva neexistuje." }, 404);
      const challenge = snap.data() || {};
      const start = challenge.startAt?.toDate?.() || new Date(challenge.startAt || 0);
      if (new Date() >= start) return json({ error: "Po začátku výzvy už účast nelze měnit." }, 409);
      if (challenge.scope === "individual") await ref.update({ participantIds: FieldValue.arrayRemove(decoded.uid) });
      else {
        const teamId = cleanText(body?.teamId, 100);
        if (teamId) await ref.update({ teamIds: FieldValue.arrayRemove(teamId) });
      }
      return json({ ok: true });
    }

    return json({ error: "Neznámá operace." }, 400);
  } catch (error) {
    console.error("POST /api/challenges:", error);
    return json({ error: "Operaci s výzvou se nepodařilo dokončit." }, 500);
  }
}
