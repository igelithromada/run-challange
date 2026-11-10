import { collection, doc, query, type Query } from "firebase/firestore";
import { db } from "../firebase";
import type { TeamData } from "../../types";

export const teamsCollection = () => collection(db, "teams");

export function allTeamsQuery(): Query {
  return query(teamsCollection());
}

export function teamRef(teamId: string) {
  return doc(db, "teams", teamId);
}

export function mapTeamSnapshot(data: { id: string; data(): Record<string, unknown> }): TeamData {
  return { id: data.id, ...data.data() } as TeamData;
}
