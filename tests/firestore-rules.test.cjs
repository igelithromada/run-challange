const { test } = require('node:test');
const fs = require('node:fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { collection, collectionGroup, doc, getDoc, getDocs, query, setDoc, updateDoc, where } = require('firebase/firestore');

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
    await assertSucceeds(getDocs(query(collectionGroup(db, 'participants'), where('userId', '==', 'u'))));
    await assertFails(updateDoc(doc(db, 'teams/t'), { memberIds: ['u', 'intruder'] }));
    await assertFails(updateDoc(doc(db, 'users/u'), { teamIdsByType: { běh: 't' } }));
    await assertFails(setDoc(doc(db, 'challenges/new'), { name: 'Forbidden' }));
    await assertFails(updateDoc(doc(db, 'challenges/c/participants/u'), { result: 999 }));
    await assertFails(setDoc(doc(env.authenticatedContext('new').firestore(), 'users/new'), { teamId: 't' }));
    await assertSucceeds(setDoc(doc(env.authenticatedContext('new').firestore(), 'users/new'), { nickname: 'Nový' }));
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'teams')));
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'challenges')));
  } finally { await env.cleanup(); }
});
