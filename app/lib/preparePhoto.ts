/** Resize on the device before upload; the server only receives the smaller photo. */
export function fitPhotoDimensions(width: number, height: number, maxEdge = 1920) {
  if (!(width > 0 && height > 0)) throw new Error("Fotografii se nepodařilo načíst.");
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function preparePhoto(file: File, kind: "activity" | "cover" = "activity"): Promise<File> {
  if (!file.size) throw new Error("Vybraná fotografie je prázdná.");
  const maxEdge = kind === "cover" ? 960 : 1920;
  const maxBytes = kind === "cover" ? 350000 : 1400000;
  let source: ImageBitmap | HTMLImageElement;
  let dispose = () => {};
  try {
    if (typeof createImageBitmap === "function") {
      try { const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); source = bitmap; dispose = () => bitmap.close(); }
      catch { source = await loadImage(file); }
    } else source = await loadImage(file);
    const originalWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const originalHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    let dimensions = fitPhotoDimensions(originalWidth, originalHeight, maxEdge);
    if (file.size <= Math.min(maxBytes, 900000) && originalWidth <= maxEdge && originalHeight <= maxEdge && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Telefon nemohl připravit fotografii. Zkus ji vybrat znovu.");
    for (let attempt = 0; attempt < 6; attempt++) {
      canvas.width = dimensions.width; canvas.height = dimensions.height;
      context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const quality = attempt === 0 ? .84 : attempt === 1 ? .74 : .65;
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Fotografii se nepodařilo zmenšit.")), "image/jpeg", quality));
      if (blob.size <= maxBytes) return new File([blob], `${file.name.replace(/\.[^.]*$/, "") || "fotografie"}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
      if (attempt >= 1) dimensions = fitPhotoDimensions(dimensions.width, dimensions.height, Math.max(640, Math.round(Math.max(dimensions.width, dimensions.height) * .8)));
    }
    throw new Error("Fotografii se nepodařilo připravit. Zkus ji vybrat znovu.");
  } finally { dispose(); }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Tento formát fotografie telefon neumí načíst. Vyber fotku ve formátu JPG, PNG nebo WebP.")); };
    image.src = url;
  });
}
