import { avatarCrop } from "./avatarCrop";
export type AvatarTransform = { zoom: number; x: number; y: number };
export type TouchPoint = { x: number; y: number };
const center = (points: TouchPoint[]) => ({
  x: points.reduce((s, p) => s + p.x, 0) / points.length,
  y: points.reduce((s, p) => s + p.y, 0) / points.length,
});
export function moveAvatar(
  width: number,
  height: number,
  initial: AvatarTransform,
  from: TouchPoint[],
  to: TouchPoint[],
): AvatarTransform {
  if (!from.length || from.length !== to.length) return initial;
  const a = center(from),
    b = center(to);
  const distance = (p: TouchPoint[]) =>
    p.length > 1 ? Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y) : 0;
  const zoom = Math.max(
    1,
    Math.min(
      3,
      initial.zoom * (distance(from) > 0 ? distance(to) / distance(from) : 1),
    ),
  );
  const before = avatarCrop(width, height, initial.zoom, initial.x, initial.y),
    after = avatarCrop(width, height, zoom, 0, 0);
  const ratio = zoom / initial.zoom;
  const offsetX = b.x - (a.x - before.offsetX) * ratio,
    offsetY = b.y - (a.y - before.offsetY) * ratio;
  const normalized = (value: number, max: number) =>
    max > 0.0001 ? Math.max(-100, Math.min(100, (value / max) * 100)) : 0;
  return {
    zoom,
    x: normalized(offsetX, (after.displayWidth - 260) / 2),
    y: normalized(offsetY, (after.displayHeight - 260) / 2),
  };
}
