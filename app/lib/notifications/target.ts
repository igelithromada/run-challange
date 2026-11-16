/** Only internal detail routes are accepted; notification data never supplies an arbitrary URL. */
export function notificationTarget(item: { runId?: string; teamId?: string; challengeId?: string }): string | null {
  const valid = (id: unknown): id is string => typeof id === "string" && id.length > 0 && !id.includes("/");
  if (valid(item.challengeId)) return `/challenges/${encodeURIComponent(item.challengeId)}`;
  if (valid(item.teamId)) return `/teams/${encodeURIComponent(item.teamId)}`;
  if (valid(item.runId)) return `/#run-${encodeURIComponent(item.runId)}`;
  return null;
}
