export default function formatTime(minutes: number): string {
  const totalSeconds = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes * 60)) : 0;
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
