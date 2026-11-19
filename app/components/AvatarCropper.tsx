"use client";
import { useEffect, useRef, useState } from "react";
import { avatarCrop } from "../lib/avatarCrop";
import {
  moveAvatar,
  type AvatarTransform,
  type TouchPoint,
} from "../lib/avatarGesture";

type Props = {
  file: File;
  busy: boolean;
  onCancel: () => void;
  onSave: (file: File) => Promise<void>;
};
export default function AvatarCropper({ file, busy, onCancel, onSave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null),
    image = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, TouchPoint>());
  const gesture = useRef<{
    transform: AvatarTransform;
    points: TouchPoint[];
  } | null>(null);
  const [url, setUrl] = useState(""),
    [dimensions, setDimensions] = useState<{
      width: number;
      height: number;
    } | null>(null);
  const saving = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const working = busy || preparing;
  const [transform, setTransform] = useState<AvatarTransform>({
    zoom: 1,
    x: 0,
    y: 0,
  });
  const transformRef = useRef(transform);
  const { zoom, x, y } = transform;
  const updateTransform = (next: AvatarTransform) => {
    transformRef.current = next;
    setTransform(next);
  };
  const resetGesture = () => {
    gesture.current = pointers.current.size
      ? {
          transform: transformRef.current,
          points: Array.from(pointers.current.values()),
        }
      : null;
  };
  const [error, setError] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      URL.revokeObjectURL(objectUrl);
      document.body.style.overflow = previous;
    };
  }, [file]);
  const crop = dimensions
    ? avatarCrop(dimensions.width, dimensions.height, zoom, x, y)
    : null;
  const save = async () => {
    if (!crop || !image.current || saving.current || busy) return;
    saving.current = true;
    setPreparing(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      const edge = Math.max(1, Math.min(512, Math.round(crop.size)));
      canvas.width = canvas.height = edge;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Fotografii se nepodařilo připravit.");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, edge, edge);
      context.drawImage(
        image.current,
        crop.sx,
        crop.sy,
        crop.size,
        crop.size,
        0,
        0,
        edge,
        edge,
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b
              ? resolve(b)
              : reject(new Error("Fotografii se nepodařilo připravit.")),
          "image/jpeg",
          0.88,
        ),
      );
      await onSave(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Fotografii se nepodařilo připravit.",
      );
    } finally {
      saving.current = false;
      setPreparing(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="avatar-crop-dialog"
      aria-labelledby="avatar-crop-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!working) onCancel();
      }}
    >
      <h2 id="avatar-crop-title">Uprav profilovou fotku</h2>
      <p>
        Jedním prstem posuň fotku, dvěma prsty ji přibliž nebo oddal. V kruhu
        vidíš výsledný avatar.
      </p>
      <div
        className="avatar-crop-frame"
        tabIndex={0}
        aria-label="Výřez fotografie. Posouvej prstem, přibliž dvěma prsty. Klávesnicí použij šipky a plus nebo minus."
        onKeyDown={(event) => {
          if (working) return;
          const next = { ...transformRef.current };
          if (event.key === "+" || event.key === "=")
            next.zoom = Math.min(3, next.zoom + 0.1);
          else if (event.key === "-") next.zoom = Math.max(1, next.zoom - 0.1);
          else if (event.key === "ArrowLeft")
            next.x = Math.max(-100, next.x - 5);
          else if (event.key === "ArrowRight")
            next.x = Math.min(100, next.x + 5);
          else if (event.key === "ArrowUp") next.y = Math.max(-100, next.y - 5);
          else if (event.key === "ArrowDown")
            next.y = Math.min(100, next.y + 5);
          else return;
          event.preventDefault();
          updateTransform(next);
        }}
        onPointerDown={(event) => {
          if (!crop || working || pointers.current.size >= 2) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const rect = event.currentTarget.getBoundingClientRect();
          pointers.current.set(event.pointerId, {
            x: ((event.clientX - rect.left) / rect.width) * 260 - 130,
            y: ((event.clientY - rect.top) / rect.height) * 260 - 130,
          });
          resetGesture();
        }}
        onPointerMove={(event) => {
          if (
            !dimensions ||
            !gesture.current ||
            !pointers.current.has(event.pointerId) ||
            working
          )
            return;
          const rect = event.currentTarget.getBoundingClientRect();
          pointers.current.set(event.pointerId, {
            x: ((event.clientX - rect.left) / rect.width) * 260 - 130,
            y: ((event.clientY - rect.top) / rect.height) * 260 - 130,
          });
          updateTransform(
            moveAvatar(
              dimensions.width,
              dimensions.height,
              gesture.current.transform,
              gesture.current.points,
              Array.from(pointers.current.values()),
            ),
          );
        }}
        onPointerUp={(event) => {
          pointers.current.delete(event.pointerId);
          resetGesture();
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          resetGesture();
        }}
        onLostPointerCapture={(event) => {
          pointers.current.delete(event.pointerId);
          resetGesture();
        }}
      >
        {url && (
          <img
            ref={image}
            src={url}
            alt="Náhled výřezu profilové fotografie"
            draggable={false}
            onLoad={(event) =>
              setDimensions({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
            onError={() =>
              setError("Fotografii se nepodařilo načíst. Zkus jinou.")
            }
            style={
              crop
                ? {
                    width: crop.displayWidth,
                    height: crop.displayHeight,
                    transform: `translate(-50%, -50%) translate(${crop.offsetX}px, ${crop.offsetY}px)`,
                  }
                : { visibility: "hidden" }
            }
          />
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="avatar-crop-actions">
        <button
          type="button"
          className="tile-button"
          disabled={working}
          onClick={onCancel}
        >
          Zrušit
        </button>
        <button
          type="button"
          className="tile-button"
          disabled={working || !crop || !!error}
          onClick={() => void save()}
        >
          {working ? "Ukládám…" : "Uložit fotografii"}
        </button>
      </div>
    </dialog>
  );
}
