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

export async function fetchTeamsPage(
  pageSize = 10,
  cursor?: QueryDocumentSnapshot<DocumentData, DocumentData>
): Promise<{ items: TeamData[]; lastDocument: QueryDocumentSnapshot<DocumentData, DocumentData> | null; hasMore: boolean }> {
  const teams = (await readCommunity<TeamData[]>("teams")).sort((a, b) => a.name.localeCompare(b.name, "cs") || a.id.localeCompare(b.id));
  const offset = cursor ? Math.max(0, teams.findIndex(team => team.id === cursor.id) + 1) : 0;
  const items = teams.slice(offset, offset + pageSize);
  return { items, lastDocument: items.length ? { id: items[items.length - 1].id } as QueryDocumentSnapshot<DocumentData, DocumentData> : null, hasMore: offset + pageSize < teams.length };
}

export async function getTeam(teamId: string): Promise<TeamData | null> {
  return readCommunity("team", teamId);
}

export async function getActiveTeamIdsForUser(userId: string): Promise<string[]> {
  void userId;
  return readCommunity("teamMemberships");
}

export async function getTeamMemberIds(teamId: string): Promise<string[]> {
  const members = await readCommunity<Array<{id: string}> | null>("teamMembers", teamId);
  return (members || []).map(member => member.id);
}
