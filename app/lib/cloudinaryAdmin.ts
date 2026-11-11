import crypto from "node:crypto";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "dvb4jm8cw";
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

function requireCloudinaryCredentials() {
  if (!API_KEY || !API_SECRET || !CLOUD_NAME) {
    throw new Error("Chybí CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY nebo CLOUDINARY_API_SECRET.");
  }
}

export function cloudinaryPublicIdFromUrl(url: string | undefined): string | null {
  if (!url || !url.includes("res.cloudinary.com/")) return null;

  try {
    const parsed = new URL(url);
    const marker = "/image/upload/";
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return null;

    let value = parsed.pathname.slice(index + marker.length);
    const parts = value.split("/").filter(Boolean);
    if (!parts.length) return null;

    // Stored application URLs are original upload URLs. If a version segment is
    // present, it is metadata and not part of the public ID.
    if (/^v\d+$/.test(parts[0])) parts.shift();
    if (!parts.length) return null;

    const last = parts[parts.length - 1];
    parts[parts.length - 1] = last.replace(/\.[a-z0-9]+$/i, "");
    const publicId = decodeURIComponent(parts.join("/")).trim();

    return publicId || null;
  } catch {
    return null;
  }
}

export function userCloudinaryPrefix(uid: string): string {
  return `dolni-lhota/users/${uid}/`;
}

export function isUserCloudinaryPublicId(publicId: string, uid: string): boolean {
  return publicId.length <= 255 && publicId.startsWith(userCloudinaryPrefix(uid));
}

export function collectCloudinaryPublicIds(urls: Array<string | undefined>, uid?: string): string[] {
  const ids = urls.map(cloudinaryPublicIdFromUrl).filter((id): id is string => Boolean(id));
  return [...new Set(uid ? ids.filter(id => isUserCloudinaryPublicId(id, uid)) : ids)];
}

export async function deleteCloudinaryImages(publicIds: string[]) {
  if (!publicIds.length) return { deleted: 0, failed: [] as string[] };
  requireCloudinaryCredentials();

  const uniqueIds = [...new Set(publicIds)];
  const failed: string[] = [];
  let deleted = 0;

  // Cloudinary Admin API accepts up to 100 public IDs per request.
  for (let i = 0; i < uniqueIds.length; i += 100) {
    const batch = uniqueIds.slice(i, i + 100);
    const body = new URLSearchParams();
    batch.forEach((publicId) => body.append("public_ids[]", publicId));
    body.set("invalidate", "true");

    const basic = Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64");
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image/upload`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        cache: "no-store",
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      failed.push(...batch);
      console.error("Cloudinary delete failed:", response.status, result);
      continue;
    }

    const deletedMap = result?.deleted && typeof result.deleted === "object" ? result.deleted : {};
    for (const publicId of batch) {
      if (deletedMap[publicId] === "deleted" || deletedMap[publicId] === "not_found") {
        deleted++;
      } else {
        failed.push(publicId);
      }
    }
  }

  return { deleted, failed };
}
