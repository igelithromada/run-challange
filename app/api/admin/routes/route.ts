import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireAdmin, authErrorResponse } from "../../../lib/apiAuth";
import { routeGroups } from "../../../lib/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATIC_PREFIX = "static:";
function staticRouteId(groupId: string, name: string) { return STATIC_PREFIX + groupId + ":" + encodeURIComponent(name); }
function parseStaticRouteId(id: string) {
  if (!id.startsWith(STATIC_PREFIX)) return null;
  const raw = id.slice(STATIC_PREFIX.length);
  const separator = raw.indexOf(":");
  if (separator < 1) return null;
  return { groupId: raw.slice(0, separator), name: decodeURIComponent(raw.slice(separator + 1)) };
}

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


async function deleteCloudinaryRaw(publicId: string) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret || !publicId) return;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signUpload({ public_id: publicId, timestamp }, apiSecret);
  const form = new URLSearchParams({ public_id: publicId, timestamp, api_key: apiKey, signature });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/destroy`, { method: "POST", body: form });
  if (!response.ok) console.warn("Cloudinary GPX delete failed:", response.status);
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
    const dynamicRoutes = snapshot.docs.map(doc => ({ id: doc.id, isStatic: false, ...doc.data() }));
    const overrideSnapshot = await adminDb.collection("recommendedRouteOverrides").get();
    const overrides = new Map(overrideSnapshot.docs.map(doc => [doc.id, doc.data()]));
    const staticRoutes = routeGroups.flatMap(group => group.routes.map(route => {
      const id = staticRouteId(group.id, route.name);
      const override = overrides.get(id) || {};
      return {
        id, isStatic: true,
        name: typeof override.name === "string" ? override.name : route.name,
        activity: "běh i chůze",
        description: typeof override.description === "string" ? override.description : route.description,
        badge: typeof override.badge === "string" ? override.badge : (route.badge || ""),
        sourceUrl: typeof override.sourceUrl === "string" ? override.sourceUrl : group.sourceUrl,
        gpxUrl: typeof override.gpxUrl === "string" ? override.gpxUrl : (route.gpxUrl || ""),
        mapUrl: typeof override.mapUrl === "string" ? override.mapUrl : route.mapUrl,
        groupId: group.id, groupTitle: group.title, disabled: override.disabled === true, deleted: override.deleted === true,
      };
    }));
    return NextResponse.json({ routes: [...dynamicRoutes, ...staticRoutes] });
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
    const description = clean(form.get("description"), 500);
    const badge = clean(form.get("badge"), 60);
    const groupId = clean(form.get("groupId"), 80) || "moje-trasy";
    const groupTitle = clean(form.get("groupTitle"), 120) || "Moje doporučené trasy";
    const groupSubtitle = clean(form.get("groupSubtitle"), 180) || "Trasy doporučené pro naši aplikaci";
    const sourceUrl = clean(form.get("sourceUrl"), 500);

    if (!name) return NextResponse.json({ error: "Chybí název trasy." }, { status: 400 });

    const uploaded = await uploadGpx(file, decoded.uid);
    const ref = adminDb.collection("recommendedRoutes").doc();
    await ref.set({
      name, activity: "běh i chůze", description, badge, groupId, groupTitle, groupSubtitle, sourceUrl,
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

export async function PUT(request: Request) {
  try {
    const { decoded, adminDb } = await requireAdmin(request);
    const form = await request.formData();
    const id = clean(form.get("id"), 128);
    if (!id) return NextResponse.json({ error: "Chybí ID trasy." }, { status: 400 });
    const name = clean(form.get("name"), 120);
    const description = clean(form.get("description"), 500);
    const badge = clean(form.get("badge"), 60);
    const sourceUrl = clean(form.get("sourceUrl"), 500);
    if (!name) return NextResponse.json({ error: "Chybí název trasy." }, { status: 400 });
    const file = form.get("file");
    let uploaded: { secureUrl: string; publicId: string } | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_GPXS) return NextResponse.json({ error: "GPX může mít maximálně 15 MB." }, { status: 413 });
      if (!file.name.toLowerCase().endsWith(".gpx")) return NextResponse.json({ error: "Nahraj soubor s příponou .gpx." }, { status: 400 });
      uploaded = await uploadGpx(file, decoded.uid);
    }
    const staticInfo = parseStaticRouteId(id);
    if (staticInfo) {
      const group = routeGroups.find(item => item.id === staticInfo.groupId);
      const route = group?.routes.find(item => item.name === staticInfo.name);
      if (!route) return NextResponse.json({ error: "Původní trasa neexistuje." }, { status: 404 });
      const ref = adminDb.collection("recommendedRouteOverrides").doc(id);
      const current = (await ref.get()).data() || {};
      if (current.deleted === true) return NextResponse.json({ error: "Tato trasa byla trvale smazána." }, { status: 410 });
      const overrideData: Record<string, unknown> = {
        name, description, badge, sourceUrl, disabled: false, deleted: false,
        updatedAt: new Date(), updatedBy: decoded.uid,
      };
      if (uploaded) {
        overrideData.gpxUrl = uploaded.secureUrl;
        overrideData.gpxPublicId = uploaded.publicId;
        overrideData.mapUrl = "https://mapy.com/fnc/v1/gpx?url=" + encodeURIComponent(uploaded.secureUrl);
      }
      await ref.set(overrideData, { merge: true });
      if (uploaded && typeof current.gpxPublicId === "string" && current.gpxPublicId) await deleteCloudinaryRaw(current.gpxPublicId);
      return NextResponse.json({ ok: true });
    }
    const ref = adminDb.collection("recommendedRoutes").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return NextResponse.json({ error: "Trasa neexistuje." }, { status: 404 });
    const current = snapshot.data() || {};
    const nextData: Record<string, unknown> = {
      name, activity: "běh i chůze", description, badge, sourceUrl,
      updatedAt: new Date(), updatedBy: decoded.uid,
    };
    if (uploaded) {
      nextData.gpxUrl = uploaded.secureUrl;
      nextData.gpxPublicId = uploaded.publicId;
      nextData.mapUrl = "https://mapy.com/fnc/v1/gpx?url=" + encodeURIComponent(uploaded.secureUrl);
    }
    await ref.update(nextData);
    if (uploaded && typeof current.gpxPublicId === "string" && current.gpxPublicId) await deleteCloudinaryRaw(current.gpxPublicId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return NextResponse.json({ error: auth.message }, { status: auth.status });
    console.error("PUT /api/admin/routes:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Trasu se nepodařilo upravit." }, { status: 500 });
  }
}
export async function DELETE(request: Request) {
  try {
    const { decoded, adminDb } = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const id = clean(body?.id, 128);
    const action = body?.action === "activate" || body?.action === "deactivate" || body?.action === "delete"
      ? body.action
      : "delete";

    if (!id) return NextResponse.json({ error: "Chybí ID trasy." }, { status: 400 });

    const staticInfo = parseStaticRouteId(id);
    if (staticInfo) {
      const ref = adminDb.collection("recommendedRouteOverrides").doc(id);
      const snapshot = await ref.get();
      const current = snapshot.data() || {};

      if (action === "delete") {
        // U statické trasy ponecháváme zdrojový záznam v aplikaci, ale
        // trvale uložíme příznak smazání, takže se už veřejně nikdy nevrátí.
        await ref.set(
          { deleted: true, disabled: false, updatedAt: new Date(), updatedBy: decoded.uid },
          { merge: true }
        );
      } else {
        await ref.set(
          {
            deleted: false,
            disabled: action === "deactivate",
            updatedAt: new Date(),
            updatedBy: decoded.uid,
          },
          { merge: true }
        );
      }

      return NextResponse.json({ ok: true, action });
    }

    const ref = adminDb.collection("recommendedRoutes").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return NextResponse.json({ error: "Trasa neexistuje." }, { status: 404 });

    if (action === "delete") {
      const publicId = typeof snapshot.data()?.gpxPublicId === "string" ? snapshot.data()?.gpxPublicId : "";
      await ref.delete();
      if (publicId) await deleteCloudinaryRaw(publicId);
    } else {
      await ref.update({
        disabled: action === "deactivate",
        deleted: false,
        updatedAt: new Date(),
        updatedBy: decoded.uid,
      });
    }

    return NextResponse.json({ ok: true, action });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return NextResponse.json({ error: auth.message }, { status: auth.status });
    return NextResponse.json({ error: "Trasu se nepodařilo změnit." }, { status: 500 });
  }
}
