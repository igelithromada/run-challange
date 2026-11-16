import { auth } from "../firebase";

export async function readCommunity<T>(resource: string, id?: string): Promise<T> {
  if (!auth.currentUser) throw new Error("Nejsi přihlášen.");
  const token = await auth.currentUser.getIdToken();
  const response = await fetch("/api/community/read", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ resource, ...(id ? { id } : {}) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Data se nepodařilo načíst.");
  return result.data as T;
}
