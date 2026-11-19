import type { Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";

/** Read exact membership documents: no collection-group index is required. */
export async function getActiveTeamMemberships(db: Firestore, uid: string, teamDocs?: QueryDocumentSnapshot[]) {
  const teams = teamDocs ?? (await db.collection("teams").get()).docs;
  const memberships = await Promise.all(teams.filter(team => !team.data().deleting).map(async team => {
    const member = await team.ref.collection("members").doc(uid).get();
    return member.exists && member.data()?.active === true ? team.id : null;
  }));
  return memberships.filter((id): id is string => id !== null);
}
