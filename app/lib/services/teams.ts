import { collection, query, orderBy, limit, startAfter, type Query, type QueryDocumentSnapshot, type DocumentData } from "firebase/firestore";
import { db } from "../firebase";
import { readCommunity } from "./community";
import type { TeamData } from "../../types";

export const teamsCollection = () => collection(db, "teams");

export function allTeamsQuery(pageSize = 10, cursor?: QueryDocumentSnapshot<DocumentData, DocumentData>): Query {
  const constraints = cursor
    ? [orderBy("name", "asc"), startAfter(cursor), limit(pageSize)]
    : [orderBy("name", "asc"), limit(pageSize)];
  return query(teamsCollection(), ...constraints);
}

export async function fetchTeamDirectory(signal: AbortSignal) {
  const { teams, joinedIds } = await readCommunity<{ teams: TeamData[]; joinedIds: string[] }>(
    "teamDirectory", undefined, { signal },
  );
  teams.sort((a, b) => a.name.localeCompare(b.name, "cs") || a.id.localeCompare(b.id));
  return { teams, joinedIds };
}

export async function getTeam(teamId: string): Promise<TeamData | null> {
  return readCommunity("team", teamId);
}

export async function getTeamMemberIds(teamId: string): Promise<string[]> {
  const members = await readCommunity<Array<{id: string}> | null>("teamMembers", teamId);
  return (members || []).map(member => member.id);
}
