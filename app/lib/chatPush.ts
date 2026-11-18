import type { Firestore } from 'firebase-admin/firestore';
import webpush from 'web-push';
import { isValidPushSubscription } from './validation';

export function chatPushReady() {
  return ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY']
    .every(key => Boolean(process.env[key]?.trim()));
}

export async function notifyChatDevices(db: Firestore, sender: string) {
  if (!chatPushReady()) return;
  const vapidDetails = {
    subject: process.env.VAPID_SUBJECT!.trim(),
    publicKey: process.env.VAPID_PUBLIC_KEY!.trim(),
    privateKey: process.env.VAPID_PRIVATE_KEY!.trim(),
  };
  const devices = await db.collection('chatPushDevices').get();
  const subscriptions = devices.docs.filter(device => device.data().uid !== sender);
  const payload = JSON.stringify({
    title: 'Společný chat',
    body: 'Nová zpráva v aplikaci Dolní Lhota v pohybu',
    tag: 'community-chat',
    url: '/chat',
  });
  const recipients = new Map<string, Promise<boolean>>();
  for (let start = 0; start < subscriptions.length; start += 20) {
    await Promise.allSettled(subscriptions.slice(start, start + 20).map(async device => {
      const { uid, subscription } = device.data();
      if (typeof uid !== 'string' || !isValidPushSubscription(subscription)) return;
      if (!recipients.has(uid)) {
        recipients.set(uid, db.collection('users').doc(uid).get().then(profile =>
          profile.exists && profile.data()?.blocked !== true && profile.data()?.deleting !== true
        ));
      }
      if (!await recipients.get(uid)) return;
      try {
        await webpush.sendNotification(subscription, payload, {
          vapidDetails, TTL: 900, timeout: 4000, topic: 'community-chat',
        });
      } catch (error) {
        if (error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
          await device.ref.delete({ lastUpdateTime: device.updateTime });
        }
      }
    }));
  }
}
