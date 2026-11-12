import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireAdmin, authErrorResponse } from "../../../lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_GPXS = 15 * 1024 * 1024;
const CLOUDINARY_TIMEOUT_MS = 20_000;

function signUpload(params: Record<string, string>, secret: string) {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return crypto.createHash("sha1").update(serialized + secret).digest("hex");
}

function clean(value: unknown, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function uploadGpx(file: File, uid: string) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Úložiště tras není nakonfigurované.");

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "dolni-lhota/routes";
  const publicId = `${uid}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const params = { folder, public_id: publicId, timestamp };
  const signature = signUpload(params, apiSecret);

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("folder", folder);
  form.append("public_id", publicId);
  form.append("signature", signature);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLOUDINARY_TIMEOUT_MS);
  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
      method: "POST", body: form, cache: "no-store", signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.secure_url !== "string") {
      console.error("Route GPX Cloudinary upload failed:", response.status, result);
      throw new Error("GPX se nepodařilo uložit.");
    }
    return { secureUrl: result.secure_url as string, publicId: typeof result.public_id === "string" ? result.public_id : publicId };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  try {
    const { adminDb } = await requireAdmin(request);
    const snapshot = await adminDb.collection("recommendedRoutes").orderBy("createdAt", "desc").get();
    return NextResponse.json({ routes: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return NextResponse.json({ error: auth.message }, { status: auth.status });
    console.error("GET /api/admin/routes:", error);
    return NextResponse.json({ error: "Trasy se nepodařilo načíst." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { decoded, adminDb } = await requireAdmin(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Vyber GPX soubor." }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_GPXS) return NextResponse.json({ error: "GPX může mít maximálně 15 MB." }, { status: 413 });
    const filename = file.name.toLowerCase();
    if (!filename.endsWith(".gpx")) return NextResponse.json({ error: "Nahraj soubor s příponou .gpx." }, { status: 400 });

    const name = clean(form.get("name"), 120);
    const activity = clean(form.get("activity"), 20);
    const description = clean(form.get("description"), 500);
    const badge = clean(form.get("badge"), 60);
    const groupId = clean(form.get("groupId"), 80) || "moje-trasy";
    const groupTitle = clean(form.get("groupTitle"), 120) || "Moje doporučené trasy";
    const groupSubtitle = clean(form.get("groupSubtitle"), 180) || "Trasy doporučené pro naši aplikaci";
    const sourceUrl = clean(form.get("sourceUrl"), 500);

    if (!name) return NextResponse.json({ error: "Chybí název trasy." }, { status: 400 });
    if (activity !== "běh" && activity !== "chůze") return NextResponse.json({ error: "Vyber běh nebo chůzi." }, { status: 400 });

    const uploaded = await uploadGpx(file, decoded.uid);
    const ref = adminDb.collection("recommendedRoutes").doc();
    await ref.set({
      name, activity, description, badge, groupId, groupTitle, groupSubtitle, sourceUrl,
      gpxUrl: uploaded.secureUrl, gpxPublicId: uploaded.publicId,
      createdAt: new Date(), createdBy: decoded.uid,
    });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return NextResponse.json({ error: auth.message }, { status: auth.status });
    console.error("POST /api/admin/routes:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Trasu se nepodařilo uložit." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { adminDb } = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const id = clean(body?.id, 128);
    if (!id) return NextResponse.json({ error: "Chybí ID trasy." }, { status: 400 });
    await adminDb.collection("recommendedRoutes").doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return NextResponse.json({ error: auth.message }, { status: auth.status });
    return NextResponse.json({ error: "Trasu se nepodařilo odstranit." }, { status: 500 });
  }
}
