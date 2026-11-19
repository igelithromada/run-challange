import { getCountFromServer, getDocs, limit, query, startAfter, orderBy, documentId, type QueryDocumentSnapshot } from "firebase/firestore";
import { mapRunSnapshot, personalHistoryQuery, userRunsQuery } from "./runs";

const PAGE_SIZE = 24;
export type GalleryCursor = { mode: "dated" | "undated"; after?: QueryDocumentSnapshot };

export async function fetchGalleryRunPage(uid: string, cursor: GalleryCursor) {
  const all = personalHistoryQuery(uid);
  const dated = userRunsQuery(uid);
  const source = cursor.mode === "dated" ? dated : query(all, orderBy(documentId(), "desc"));
  const pageQuery = cursor.after ? query(source, startAfter(cursor.after), limit(PAGE_SIZE)) : query(source, limit(PAGE_SIZE));
  const snapshot = await getDocs(pageQuery).catch(error => {
    // Keep the existing gallery usable while a new production index is building.
    if (cursor.mode !== "dated" || error?.code !== "failed-precondition") throw error;
    return null;
  });
  if (!snapshot) {
    return { items: (await getDocs(all)).docs.map(mapRunSnapshot), next: null };
  }

  const items = snapshot.docs
    .filter(record => cursor.mode === "dated" || !Object.hasOwn(record.data(), "timestamp"))
    .map(mapRunSnapshot);

  let next: GalleryCursor | null = null;
  if (snapshot.size === PAGE_SIZE) {
    next = { mode: cursor.mode, after: snapshot.docs.at(-1) };
  } else if (cursor.mode === "dated") {
    // Firestore orderBy skips documents whose ordering field is missing.
    // Only scan the undated archive if it actually contains legacy records.
    const counts = await Promise.all([getCountFromServer(all), getCountFromServer(dated)]).catch(() => null);
    // The photo page can still be available offline or while a count request fails.
    if (!counts || counts[0].data().count > counts[1].data().count) next = { mode: "undated" };
  }
  return { items, next };
}
