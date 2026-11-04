/** Vrací lehčí Cloudinary variantu; ostatní URL ponechá beze změny. */
export function cloudinaryImageUrl(url: string | undefined, width = 640): string {
  if (!url || !url.includes("/image/upload/")) return url || "";
  return url.replace("/image/upload/", `/image/upload/f_auto,q_auto,w_${width},c_limit/`);
}
