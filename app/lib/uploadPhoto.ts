import { auth } from "./firebase";
import { preparePhoto } from "./preparePhoto";

export type UploadedPhoto = { secureUrl: string; publicId: string };

export async function uploadPhoto(file: File, kind: "activity" | "cover" | "avatar" = "activity"): Promise<UploadedPhoto> {
  const user = auth.currentUser;
  if (!user) throw new Error("Nejsi přihlášen.");
  const form = new FormData();
  // The avatar cropper already exports a bounded JPEG.
  form.append("file", kind === "avatar" ? file : await preparePhoto(file, kind));
  const token = await user.getIdToken();
  if (auth.currentUser?.uid !== user.uid) throw new Error("Přihlášení se změnilo. Vyber fotografii znovu.");
  const response = await fetch("/api/media/upload", {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.secureUrl !== "string" || typeof result.publicId !== "string") {
    throw new Error(result.error || "Fotografii se nepodařilo nahrát.");
  }
  return { secureUrl: result.secureUrl, publicId: result.publicId };
}
