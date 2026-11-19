"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { cloudinaryImageUrl } from "../lib/imageUrl";
import { uploadPhoto, type UploadedPhoto } from "../lib/uploadPhoto";

export function useCoverDraft(scope: string) {
  const [draft, setDraft] = useState<{ scope: string; file: File | null }>();
  const saved = useRef<{ scope: string; file: File; photo: UploadedPhoto } | null>(null);
  const selected = draft?.scope === scope ? draft : undefined;
  return {
    file: selected?.file,
    select: (file: File | null) => setDraft({ scope, file }),
    reset: () => { setDraft(undefined); saved.current = null; },
    async resolve(existing?: { avatarUrl?: string; avatarPublicId?: string }) {
      if (!selected) return { avatarUrl: existing?.avatarUrl || "", avatarPublicId: existing?.avatarPublicId || "" };
      if (!selected.file) return { avatarUrl: "", avatarPublicId: "" };
      if (saved.current?.scope !== scope || saved.current.file !== selected.file) {
        const photo = await uploadPhoto(selected.file, "cover");
        saved.current = { scope, file: selected.file, photo };
      }
      return { avatarUrl: saved.current.photo.secureUrl, avatarPublicId: saved.current.photo.publicId };
    },
  };
}

export default function CoverField({ draft, existing, busy }: {
  draft: ReturnType<typeof useCoverDraft>; existing?: string; busy: boolean;
}) {
  const image = useRef<HTMLImageElement>(null);
  const file = draft.file;
  useEffect(() => {
    if (!file || !image.current) return;
    const url = URL.createObjectURL(file);
    image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const preview = file === undefined ? cloudinaryImageUrl(existing, 160) : undefined;
  return <>
    <label className="professional-form-file">
      <ImagePlus size={19} aria-hidden="true"/><span>{preview || file ? "Změnit obrázek" : "Přidat obrázek"}</span>
      <small className="professional-file-hint">volitelné</small>
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
        onChange={event => {
          const selected = event.target.files?.[0];
          event.target.value = "";
          if (selected) draft.select(selected);
        }}/>
    </label>
    {(preview || file) && <div className="challenge-image-preview">
      {(preview || file) && <img key={file ? "local" : "saved"} ref={image} src={preview} width={64} height={64} alt="Náhled obrázku"/>}
      <button type="button" className="run-secondary-button" disabled={busy} onClick={() => draft.select(null)}>Odebrat obrázek</button>
    </div>}
  </>;
}
