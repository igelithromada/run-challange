import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";

type CommunityEvent = {
  recipientUid: string;
  actorUid?: string;
  category: "teams" | "challenges";
  title: string;
  body: string;
  teamId?: string;
  challengeId?: string;
};

/** Read before any transaction writes. Enqueue with the domain change so retries cannot duplicate it. */
export async function prepareCommunityNotification(db: Firestore, tx: Transaction, event: CommunityEvent) {
  if (!event.recipientUid || event.recipientUid === event.actorUid) return null;
  const recipient = await tx.get(db.collection("users").doc(event.recipientUid));
  if (!recipient.exists || recipient.data()?.socialNotifications?.[event.category] === false) return null;
  const actor = event.actorUid ? await tx.get(db.collection("publicProfiles").doc(event.actorUid)) : null;
  const actorNickname = String(actor?.data()?.nickname || "Uživatel").slice(0, 80);
  return {
    ...event,
    body: event.body.replace(/^\{actor\}/, () => actorNickname),
    actorNickname,
    actorUid: event.actorUid || "",
    type: `community_${event.category}`,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  };
}

/** Per-participant receipts survive reading/deleting the notification and concurrent cron retries. */
export async function notifyChallengeState(db: Firestore, challengeId: string) {
  const ref = db.collection("challenges").doc(challengeId);
  const initial = await ref.get();
  const state = initial.data()?.state;
  if (!initial.data()?.notificationPending || initial.data()?.deleting || (state !== "active" && state !== "completed")) return;
  const participants = await ref.collection("participants").where("active", "==", true).get();
  for (const participant of participants.docs) {
    await db.runTransaction(async tx => {
      const [challenge, member] = await Promise.all([tx.get(ref), tx.get(participant.ref)]);
      const data = challenge.data();
      if (!data || data.deleting || data.state !== state || member.data()?.active !== true || member.data()?.stateNotified?.[state]) return;
      const notification = await prepareCommunityNotification(db, tx, {
        recipientUid: participant.id,
        category: "challenges",
        challengeId,
        title: state === "active" ? "Výzva začala" : "Výzva je vyhodnocená",
        body: state === "active" ? `Výzva „${data.name}“ právě probíhá. Podívej se na svůj cíl.` : `Výzva „${data.name}“ skončila. Podívej se na výsledky.`,
      });
      tx.set(participant.ref, { stateNotified: { [state]: true } }, { merge: true });
      if (notification) tx.create(db.collection("notifications").doc(), notification);
    });
  }
  // A transition during delivery must retain the next state's pending flag.
  await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (current.data()?.state === state && !current.data()?.deleting) tx.update(ref, { notificationPending: false });
  });
}
