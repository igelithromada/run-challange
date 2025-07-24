export default function formatTime(minutes: number): string {
  const min = Math.floor(minutes);
  const sec = Math.round((minutes - min) * 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
