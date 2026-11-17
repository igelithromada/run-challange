export function avatarCrop(width: number, height: number, zoom: number, x: number, y: number, viewport = 260) {
  const scale = Math.max(viewport / width, viewport / height) * Math.max(1, Math.min(3, zoom));
  const displayWidth = width * scale, displayHeight = height * scale;
  const offsetX = Math.max(-100, Math.min(100, x)) / 100 * (displayWidth - viewport) / 2;
  const offsetY = Math.max(-100, Math.min(100, y)) / 100 * (displayHeight - viewport) / 2;
  const size = viewport / scale;
  return { displayWidth, displayHeight, offsetX, offsetY, sx: Math.max(0, (width - size) / 2 - offsetX / scale), sy: Math.max(0, (height - size) / 2 - offsetY / scale), size };
}
