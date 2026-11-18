const { test } = require('node:test');
const fs = require('node:fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { collection, collectionGroup, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where } = require('firebase/firestore');

test('Firestore: authenticated team/challenge reads and server-only membership writes', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-run-challenge', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') } });
  try {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'users/u'), { nickname: 'Uživatel' });
      await setDoc(doc(db, 'teams/t'), { name: 'Tým', memberIds: ['u'] });
      await setDoc(doc(db, 'challenges/c'), { name: 'Výzva' });
      await setDoc(doc(db, 'challenges/c/participants/u'), { userId: 'u', active: true });
    });
    const db = env.authenticatedContext('u').firestore();
    await assertSucceeds(getDocs(collection(db, 'teams')));
    await assertSucceeds(getDoc(doc(db, 'teams/t')));
    await assertSucceeds(getDocs(collection(db, 'challenges')));
    await assertSucceeds(getDocs(collection(db, 'challenges/c/participants')));
    await assertSucceeds(getDoc(doc(db, 'challenges/c/participants/u')));
    await assertFails(getDocs(query(collectionGroup(db, 'participants'), where('userId', '==', 'u'))));
    await assertFails(updateDoc(doc(db, 'teams/t'), { memberIds: ['u', 'intruder'] }));
    await assertFails(updateDoc(doc(db, 'users/u'), { teamIdsByType: { běh: 't' } }));
    await assertFails(setDoc(doc(db, 'challenges/new'), { name: 'Forbidden' }));
    await assertFails(updateDoc(doc(db, 'challenges/c/participants/u'), { result: 999 }));
    await assertFails(setDoc(doc(env.authenticatedContext('new').firestore(), 'users/new'), { role: 'admin' }));
    await assertSucceeds(setDoc(doc(env.authenticatedContext('new').firestore(), 'users/new'), { nickname: 'Nový' }));
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'teams')));
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'challenges')));
  } finally { await env.cleanup(); }
});

test('only eligible members can subscribe to the chat revision', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-run-challenge', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') } });
  try {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'chatMeta/community'), { revision: 'test' });
      await setDoc(doc(db, 'chatMeta/changes'), { changes: [] });
      await setDoc(doc(db, 'users/reader'), { nickname: 'Čtenář' });
      await setDoc(doc(db, 'users/blocked'), { blocked: true });
      await setDoc(doc(db, 'users/deleting'), { deleting: true });
    });
    const reader = env.authenticatedContext('reader').firestore();
    await new Promise((resolve, reject) => {
      const unsubscribe = onSnapshot(doc(reader, 'chatMeta/community'), snapshot => {
        if (snapshot.metadata.fromCache) return;
        unsubscribe();
        if (snapshot.data()?.revision === 'test') resolve();
        else reject(new Error('Missing chat revision'));
      }, reject);
    });
    await assertFails(getDocs(collection(reader, 'chatMeta')));
    await assertFails(getDoc(doc(reader, 'chatMeta/changes')));
    await assertFails(setDoc(doc(reader, 'chatMeta/community'), { revision: 'invalid' }));
    await assertFails(getDoc(doc(reader, 'communityChat/test')));
    for (const uid of ['blocked', 'deleting', 'missing']) {
      await assertFails(getDoc(doc(env.authenticatedContext(uid).firestore(), 'chatMeta/community')));
    }
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'chatMeta/community')));
  } finally {
    await env.cleanup();
  }
});
