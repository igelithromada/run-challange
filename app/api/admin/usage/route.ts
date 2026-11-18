import { getApps } from "firebase-admin/app";
import { NextResponse } from "next/server";
import { authErrorResponse, requireAdmin } from "../../../lib/apiAuth";
import { getCloudinaryUsage } from "../../../lib/cloudinaryAdmin";
import { CLOUDINARY_FREE_CREDITS, type MonitoringIssue, type ServiceUsage } from "../../../lib/serviceUsage";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

function pacificMidnight(now: Date) {
  const timeZone = "America/Los_Angeles";
  const date = new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
  const candidate = new Date(Date.parse(date + "T08:00:00Z"));
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", hourCycle: "h23" }).format(candidate);
  return new Date(candidate.getTime() - Number(hour) * 3_600_000);
}

class MonitoringError extends Error {
  constructor(readonly issue: MonitoringIssue) { super(issue); }
}

async function monitoringError(response: Response) {
  const body = await response.json().catch(() => null);
  const details: Array<{ reason?: string }> = Array.isArray(body?.error?.details) ? body.error.details : [];
  if (details.some(detail => detail.reason === "SERVICE_DISABLED")) return new MonitoringError("api_disabled");
  if (response.status === 401 || response.status === 403) return new MonitoringError("permissions");
  if (response.status === 400) return new MonitoringError("query");
  return new MonitoringError("unavailable");
}

async function documentOperations(project: string, token: string, operation: "read" | "write" | "delete", start: Date, end: Date) {
  if (end <= start) return 0;
  const url = new URL(`https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(project)}/timeSeries`);
  url.searchParams.set("filter", `metric.type="firestore.googleapis.com/document/${operation}_ops_count" AND resource.type="firestore.googleapis.com/Database" AND resource.labels.database_id="(default)"`);
  url.searchParams.set("interval.startTime", start.toISOString());
  url.searchParams.set("interval.endTime", end.toISOString());
  url.searchParams.set("view", "FULL");
  const signal = AbortSignal.timeout(5000);
  let total = 0;
  do {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal });
    if (!response.ok) throw await monitoringError(response);
    const data = await response.json();
    for (const series of data.timeSeries ?? []) {
      for (const point of series.points ?? []) {
        const count = Number(point.value?.int64Value);
        if (Number.isFinite(count)) total += count;
      }
    }
    if (!data.nextPageToken) return total;
    url.searchParams.set("pageToken", data.nextPageToken);
  } while (true);
}

async function firestoreUsage(now: Date): Promise<Pick<ServiceUsage, "firestore" | "firestoreIssue">> {
  const { credential, projectId } = getApps()[0]?.options ?? {};
  const project = projectId || process.env.FIREBASE_PROJECT_ID;
  if (!credential || !project) throw new MonitoringError("permissions");

  const { access_token } = await credential.getAccessToken();
  const since = pacificMidnight(now);
  const operations = ["read", "write", "delete"] as const;
  const results = await Promise.allSettled(operations.map(operation => documentOperations(project, access_token, operation, since, now)));
  const [reads, writes, deletes] = results.map(result => result.status === "fulfilled" ? result.value : null);
  const failures = results.flatMap(result => result.status === "rejected"
    ? [result.reason instanceof MonitoringError ? result.reason.issue : "unavailable" as const]
    : []);
  const firestore = reads === null && writes === null && deletes === null
    ? null : { since: since.toISOString(), reads, writes, deletes };
  const firestoreIssue = failures.find(issue => issue !== "unavailable") ?? failures[0] ?? null;
  return { firestore, firestoreIssue };
}

function nonNegative(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

async function cloudinaryUsage(): Promise<ServiceUsage["cloudinary"]> {
  const report = await getCloudinaryUsage();
  return {
    credits: nonNegative(report.credits?.usage),
    limit: nonNegative(report.credits?.limit) || CLOUDINARY_FREE_CREDITS,
    storage: nonNegative(report.storage?.usage),
    bandwidth: nonNegative(report.bandwidth?.usage),
  };
}

async function collect(now: Date): Promise<ServiceUsage> {
  const [firestore, cloudinary] = await Promise.allSettled([firestoreUsage(now), cloudinaryUsage()]);
  return {
    checkedAt: now.toISOString(),
    ...(firestore.status === "fulfilled" ? firestore.value : {
      firestore: null,
      firestoreIssue: firestore.reason instanceof MonitoringError ? firestore.reason.issue : "unavailable",
    }),
    cloudinary: cloudinary.status === "fulfilled" ? cloudinary.value : null,
  };
}

let cache: { expires: number; data: Promise<ServiceUsage> } | undefined;

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const now = new Date();
    const timestamp = now.getTime();
    // Do not serve yesterday's Firestore counters after the Pacific reset.
    const nextReset = pacificMidnight(new Date(timestamp + 5 * 60_000)).getTime();
    if (!cache || cache.expires <= timestamp) {
      cache = {
        expires: nextReset > timestamp ? nextReset : timestamp + 5 * 60_000,
        data: collect(now),
      };
    }
    return NextResponse.json(await cache.data, { headers });
  } catch (error) {
    const authError = authErrorResponse(error);
    return NextResponse.json({ error: authError?.message || "Spotřebu se nepodařilo načíst." }, { status: authError?.status ?? 500, headers });
  }
}
