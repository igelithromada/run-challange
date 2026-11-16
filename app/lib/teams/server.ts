import type { Firestore } from "firebase-admin/firestore";

/** Read exact membership documents: no collection-group index is required. */
export async function getActiveTeamMemberships(db: Firestore, uid: string) {
  const teams = await db.collection("teams").get();
  const memberships = await Promise.all(teams.docs.filter(team => !team.data().deleting).map(async team => {
    const member = await team.ref.collection("members").doc(uid).get();
    return member.exists && member.data()?.active === true ? team.id : null;
  }));
  return memberships.filter((id): id is string => id !== null);
}
