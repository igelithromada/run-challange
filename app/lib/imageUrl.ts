/** Vrací lehčí Cloudinary variantu; ostatní URL ponechá beze změny. */
export function cloudinaryImageUrl(url: string | undefined, width = 640): string {
  if (!url || !url.includes("/image/upload/")) return url || "";
  return url.replace("/image/upload/", `/image/upload/f_auto,q_auto,w_${width},c_limit/`);
}


/** Inline previews must never fall back to downloading a full-size legacy image. */
export function activityThumbnailUrl(url: string): string {
  if (url?.startsWith("data:image/") || url?.startsWith("/sandbox-")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com" || parsed.username || parsed.password) return "";
    const marker = "/image/upload/";
    const position = parsed.pathname.indexOf(marker);
    if (position < 0) return "";
    const prefix = parsed.pathname.slice(0, position + marker.length);
    const asset = parsed.pathname.slice(position + marker.length);
    const transform = "f_auto,q_auto:eco,c_limit,w_640,h_720/";
    // Apply the small output size after existing transformations, before the asset version.
    const version = asset.search(/(?:^|\/)v\d+\//);
    const insertion = version < 0 ? 0 : version + (asset[version] === "/" ? 1 : 0);
    parsed.pathname = prefix + asset.slice(0, insertion) + transform + asset.slice(insertion);
    return parsed.toString();
  } catch { return ""; }
}
