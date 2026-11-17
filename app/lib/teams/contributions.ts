import { activityAmount } from "../activity";
import { normalizeActivityType } from "../validation";
import { FieldValue, type Firestore } from "firebase-admin/firestore";

/** Reconcile against the current activity inside each transaction. Safe to retry
 * after partial failures and safe against simultaneous edits or deletion. */
export async function syncRunTeamContributions(db: Firestore, runId: string) {
  const runRef = db.collection("runs").doc(runId);
  const [run, teams] = await Promise.all([runRef.get(), db.collection("teams").get()]);
  const data = run.data() || {};
  const ids = new Set<string>(teams.docs.map(team => team.id));
  if (Array.isArray(data.teamIds)) for (const id of data.teamIds) if (typeof id === "string" && id && !id.includes("/")) ids.add(id);
  for (const teamId of ids) {
    const teamRef = db.collection("teams").doc(teamId);
    const contributionRef = teamRef.collection("activityContributions").doc(runId);
    await db.runTransaction(async tx => {
      const [currentRun, team, contribution] = await Promise.all([tx.get(runRef), tx.get(teamRef), tx.get(contributionRef)]);
      const current = currentRun.data();
      const previous = contribution.data();
      const assigned = Array.isArray(current?.teamIds) && current.teamIds.includes(teamId);
      const keep = !!current && !current.deleting && team.exists && !team.data()?.deleting && (assigned || contribution.exists);
      if (!contribution.exists && !keep) return;
      const deltas: Record<string, number> = {};
      const adjust = (type: unknown, km: number, count: number) => {
        const prefix = type === "dřepy" ? "squat" : type === "kliky" ? "pushup" : type === "chůze" ? "walking" : "running";
        const field = type === "dřepy" || type === "kliky" ? "Repetitions" : "Km";
        deltas[`stats.${prefix}${field}`] = (deltas[`stats.${prefix}${field}`] || 0) + km;
        deltas[`stats.${prefix}Activities`] = (deltas[`stats.${prefix}Activities`] || 0) + count;
      };
      if (previous) adjust(previous.type, -activityAmount(previous), -1);
      if (keep) adjust(current.type, activityAmount(current), 1);
      const updates = Object.fromEntries(Object.entries(deltas).filter(([, value]) => value !== 0).map(([key, value]) => [key, FieldValue.increment(value)]));
      if (team.exists && Object.keys(updates).length) tx.update(teamRef, updates);
      if (keep) tx.set(contributionRef, { activityId: runId, userId: current.uid, type: normalizeActivityType(current.type), km: Number(current.km) || 0, repetitions: Number(current.repetitions) || 0, createdAt: previous?.createdAt || current.createdAt || FieldValue.serverTimestamp() });
      else if (contribution.exists) tx.delete(contributionRef);
    });
  }
}
