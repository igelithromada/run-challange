import { auth } from "../firebase";

export async function readCommunity<T>(resource: string, id?: string, options?: { filters?: Record<string, string>; signal: AbortSignal }): Promise<T> {
  if (!auth.currentUser) throw new Error("Nejsi přihlášen.");
  const token = await auth.currentUser.getIdToken();
  const response = await fetch("/api/community/read", {
    method: "POST",
    cache: "no-store",
    signal: options?.signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ resource, ...(id ? { id } : {}), filters: options?.filters }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Data se nepodařilo načíst.");
  return result.data as T;
}
