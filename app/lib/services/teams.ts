import { collection, doc, getDoc, query, setDoc, type Query, type SetOptions } from "firebase/firestore";
import { db } from "../firebase";
import type { TeamData } from "../../types";

export const teamsCollection = () => collection(db, "teams");

export function allTeamsQuery(): Query {
  return query(teamsCollection());
}

export function teamRef(teamId: string) {
  return doc(db, "teams", teamId);
}

export async function getTeam(teamId: string): Promise<TeamData | null> {
  const snapshot = await getDoc(teamRef(teamId));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as TeamData) : null;
}

export async function mergeTeam(
  teamId: string,
  data: Partial<Omit<TeamData, "id">>,
  options: SetOptions = { merge: true }
): Promise<void> {
  await setDoc(teamRef(teamId), data, options);
}

