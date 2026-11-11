import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";
import { isUserCloudinaryPublicId, userCloudinaryPrefix } from "../../../lib/cloudinaryAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const CLOUDINARY_TIMEOUT_MS = 15_000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function signUpload(params: Record<string, string>, secret: string) {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto.createHash("sha1").update(serialized + secret).digest("hex");
}

export async function POST(request: Request) {
  try {
    const { decoded } = await requireUser(request);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: "Úložiště obrázků není nakonfigurované." }, { status: 503 });
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Chybí obrázek." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Povolené jsou pouze JPG, PNG a WebP." }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Obrázek může mít maximálně 5 MB." }, { status: 413 });
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = `dolni-lhota/users/${decoded.uid}`;
    const params = { folder, timestamp };
    const signature = signUpload(params, apiSecret);

    const upload = new FormData();
    upload.append("file", file);
    upload.append("api_key", apiKey);
    upload.append("timestamp", timestamp);
    upload.append("folder", folder);
    upload.append("signature", signature);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CLOUDINARY_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: upload, cache: "no-store", signal: controller.signal }
      );
    } finally {
      clearTimeout(timeout);
    }

    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.secure_url !== "string") {
      console.error("Cloudinary upload failed:", response.status, result);
      return NextResponse.json({ error: "Obrázek se nepodařilo nahrát." }, { status: 502 });
    }

    const publicId = typeof result.public_id === "string" ? result.public_id : "";
    const secureUrl = result.secure_url;
    if (
      typeof secureUrl !== "string" ||
      !secureUrl.startsWith(`https://res.cloudinary.com/`) ||
      !isUserCloudinaryPublicId(publicId, decoded.uid) ||
      !publicId.startsWith(userCloudinaryPrefix(decoded.uid))
    ) {
      console.error("Cloudinary upload returned an unexpected asset:", {
        secureUrl: typeof secureUrl === "string" ? secureUrl.slice(0, 160) : "",
        publicId,
      });
      return NextResponse.json({ error: "Nahraný obrázek má neplatné údaje." }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      secureUrl,
      publicId,
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) {
      return NextResponse.json({ error: authResponse.message }, { status: authResponse.status });
    }

    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Nahrávání obrázku trvalo příliš dlouho." }, { status: 504 });
    }

    console.error("POST /api/media/upload:", error);
    return NextResponse.json({ error: "Obrázek se nepodařilo nahrát." }, { status: 500 });
  }
}
