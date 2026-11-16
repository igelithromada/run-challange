const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const app = initializeApp({ projectId: 'demo-run-api' }, 'api-integration');
const db = getFirestore(app);
const load = Module._load;
Module._load = function(request) {
  if (request.endsWith('/apiAuth')) return { requireUser: async request => ({ decoded: { uid: request.headers.get('x-test-user') || 'u' }, adminDb: db }) };
  return load.apply(this, arguments);
};
const teams = require('../app/api/teams/manage/route.ts');
const challenges = require('../app/api/challenges/manage/route.ts');
async function call(handler, body, uid = 'u') {
  return handler.POST(new Request('https://example.test/api', { method:'POST', headers:{'x-test-user':uid}, body:JSON.stringify(body) }));
}
test('real Firestore transactions: concurrent creation, switching and deletion', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  try {
    const creations = await Promise.all(Array.from({length:6}, () => call(teams,{action:'create',name:'Souběžný tým',type:'běh'})));
    assert.equal(creations.filter(r=>r.status===200).length,1);
    assert.equal(creations.filter(r=>r.status===409).length,5);
    const profile=(await db.collection('users').doc('u').get()).data();
    const first=profile.teamIdsByType.běh;
    await db.collection('teams').doc('second').set({name:'Druhý',createdBy:'u',type:'běh',memberIds:[]});
    assert.equal((await call(teams,{action:'join',teamId:'second'})).status,200);
    assert.deepEqual((await db.collection('teams').doc(first).get()).data().memberIds,[]);
    // The join is either included in the deletion snapshot, or rejected after
    // the tombstone. In neither ordering may a dangling membership survive.
    const responses=await Promise.all([call(teams,{action:'join',teamId:'second'},'v'),call(teams,{action:'delete',teamId:'second'})]);
    assert.ok([200,404,409].includes(responses[0].status));
    assert.equal(responses[1].status,200);
    assert.equal((await db.collection('teams').doc('second').get()).exists,false);
    const v=(await db.collection('users').doc('v').get()).data();
    assert.ok(!v?.teamIdsByType?.běh);
    const start=new Date();start.setDate(start.getDate()+1);
    const end=new Date();end.setDate(end.getDate()+5);
    const body={action:'create',kind:'distance',activityType:'běh',goal:5,startDate:start.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10)};
    const created=await Promise.all(Array.from({length:6},(_,i)=>call(challenges,{...body,name:'Výzva '+i})));
    assert.equal(created.filter(r=>r.status===200).length,5);
    assert.equal(created.filter(r=>r.status===409).length,1);
    const scoring=require('../app/lib/challenges/server.ts');
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
    const shared=db.collection('challenges').doc('shared');
    await shared.set({name:'Společná',kind:'sharedDistance',activityType:'běh',goal:20,state:'active',startDate:yesterday.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10)});
    for(const [member,km] of [['u',5],['v',7]]) {
      await shared.collection('participants').doc(member).set({userId:member,active:true,joinedAt:Timestamp.fromDate(yesterday)});
      await db.collection('runs').doc(member).set({uid:member,type:'běh',km,timestamp:Timestamp.now()});
    }
    await Promise.all([scoring.reconcileChallengesForUser(db,'u'),scoring.reconcileChallengesForUser(db,'v')]);
    assert.equal((await shared.get()).data().sharedProgress,12);
    await call(challenges,{action:'leave',challengeId:'shared'},'u');
    assert.equal((await shared.get()).data().sharedProgress,7);
  } finally {
    for(const collection of ['teams','users','challenges','challengeNames','runs'])await db.recursiveDelete(db.collection(collection));
    await db.terminate();await deleteApp(app);
  }
});
