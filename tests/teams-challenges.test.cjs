const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const path = require('node:path');

// Exercise the real API handlers and scoring code against a strict Firestore
// double: transaction reads after writes and batches over 500 writes must fail.
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
class Timestamp {
  constructor(ms) { this.ms = ms; }
  static now() { return new Timestamp(Date.now()); }
  toMillis() { return this.ms; }
  toDate() { return new Date(this.ms); }
}
const field = {
  increment: value => ({ operation: 'increment', value }),
  arrayUnion: (...value) => ({ operation: 'union', value }),
  arrayRemove: (...value) => ({ operation: 'remove', value }),
};
let db, uid = 'u', authenticated = true;
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'firebase-admin/firestore') return { Timestamp, FieldValue: field };
  if (request.endsWith('/apiAuth')) return { requireUser: async () => {
    if (!authenticated) throw new Error('UNAUTHORIZED');
    return { decoded: { uid }, adminDb: db };
  } };
  return originalLoad.apply(this, arguments);
};
class DB {
  constructor(seed = {}) { this.store = new Map(Object.entries(seed)); this.sequence = 0; this.batchSizes = []; }
  collection(p) { return new Query(this, p); }
  apply(ref, values, merge = false) {
    const old = this.store.get(ref.path) || {};
    const next = merge ? { ...old } : {};
    for (const [key, value] of Object.entries(values)) {
      if (value?.operation === 'increment') next[key] = (old[key] || 0) + value.value;
      else if (value?.operation === 'union') next[key] = [...new Set([...(old[key] || []), ...value.value])];
      else if (value?.operation === 'remove') next[key] = (old[key] || []).filter(x => !value.value.includes(x));
      else next[key] = value;
    }
    this.store.set(ref.path, next);
  }
  batch() {
    const writes = [];
    const b = {
      set: (r, d, o) => writes.push(() => this.apply(r, d, o?.merge)),
      update: (r, d) => writes.push(() => this.apply(r, d, true)),
      commit: async () => { assert.ok(writes.length <= 500); this.batchSizes.push(writes.length); writes.forEach(w => w()); },
    };
    return b;
  }
  async runTransaction(fn) {
    const writes = [];
    const result = await fn({
      get: async ref => { assert.equal(writes.length, 0, 'Firestore forbids reads after writes'); return ref.get(); },
      set: (r, d, o) => writes.push(() => this.apply(r, d, o?.merge)),
      create: (r, d) => writes.push(() => { assert.ok(!this.store.has(r.path)); this.apply(r, d); }),
      update: (r, d) => writes.push(() => this.apply(r, d, true)),
      delete: r => writes.push(() => this.store.delete(r.path)),
    });
    assert.ok(writes.length <= 500);
    writes.forEach(w => w()); return result;
  }
  async recursiveDelete(ref) { for (const key of this.store.keys()) if (key === ref.path || key.startsWith(ref.path + '/')) this.store.delete(key); }
}
class Ref {
  constructor(db, p) { this.db = db; this.path = p; this.id = p.split('/').at(-1); }
  collection(p) { return new Query(this.db, this.path + '/' + p); }
  async get() { return { id: this.id, ref: this, exists: this.db.store.has(this.path), data: () => this.db.store.get(this.path) }; }
  async set(d, o) { this.db.apply(this, d, o?.merge); }
  async update(d) { assert.ok(this.db.store.has(this.path)); this.db.apply(this, d, true); }
  async delete() { this.db.store.delete(this.path); }
}
class Query {
  constructor(db, p, filters = []) { this.db = db; this.path = p; this.filters = filters; }
  doc(id = 'generated-' + (++this.db.sequence)) { assert.ok(id && !id.includes('/'), 'document ID must be a single path segment'); return new Ref(this.db, this.path + '/' + id); }
  where(key, op, value) { return new Query(this.db, this.path, [...this.filters, [key, op, value]]); }
  async get() {
    const docs = [];
    for (const [p, d] of this.db.store) {
      if (!p.startsWith(this.path + '/') || p.split('/').length !== this.path.split('/').length + 1) continue;
      if (!this.filters.every(([k, op, v]) => op === '==' ? d[k] === v : op === 'in' ? v.includes(d[k]) : (d[k] || []).includes(v))) continue;
      docs.push(await new Ref(this.db, p).get());
    }
    return { docs, size: docs.length, empty: !docs.length };
  }
}
const teams = require('../app/api/teams/manage/route.ts');
const challenges = require('../app/api/challenges/manage/route.ts');
const scoring = require('../app/lib/challenges/server.ts');
async function call(handler, body) {
  const response = await handler.POST(new Request('https://example.test/api', { method: 'POST', body: JSON.stringify(body) }));
  return { status: response.status, body: await response.json() };
}
const day = delta => {
  const d = new Date(); d.setUTCDate(d.getUTCDate() + delta);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague', year:'numeric',month:'2-digit',day:'2-digit' }).format(d);
};
const team = (members, type = 'běh') => ({ name: 'Tým', type, memberIds: members, createdBy: 'u' });
const challenge = (kind = 'distance') => ({ name: 'Test', nameKey: 'test', createdBy:'u', kind, activityType:'běh', goal:10, startDate:day(-4), endDate:day(1), state:'active', participantCount:1 });
const tsAt = days => new Timestamp(Date.now() + days * 86400000);

test('teams: create repairs a stale profile, but blocks actual duplicate membership', async () => {
  db = new DB({ 'users/u': { teamIdsByType: { běh:'deleted' } } });
  assert.equal((await call(teams, { action:'create', name:'Nový', type:'běh' })).status, 200);
  assert.equal((await call(teams, { action:'create', name:'Další', type:'běh' })).status, 409);
});
test('teams: switching repairs duplicate memberships and preserves walking membership', async () => {
  db = new DB({ 'teams/a':team(['u']), 'teams/b':team(['u']), 'teams/c':team([]), 'teams/w':team(['u'],'chůze'), 'users/u':{teamIdsByType:{běh:'a',chůze:'w'}} });
  assert.equal((await call(teams,{action:'join',teamId:'c'})).status,200);
  assert.deepEqual(db.store.get('teams/a').memberIds,[]);
  assert.deepEqual(db.store.get('teams/b').memberIds,[]);
  assert.deepEqual(db.store.get('teams/c').memberIds,['u']);
  assert.deepEqual(db.store.get('teams/w').memberIds,['u']);
  const leave = await call(teams,{action:'leave',teamId:'c'});
  assert.equal(leave.body.teamIdsByType.běh,null);
  assert.equal(leave.body.teamIdsByType.chůze,'w');
  assert.equal((await call(teams,{action:'leave',teamId:'c'})).status,200);
});
test('teams: deleting rejects joins and deletion clears only references to that team', async () => {
  db = new DB({ 'teams/a':{...team(['u','v']),deleting:true}, 'users/u':{teamIdsByType:{běh:'b'}}, 'users/v':{teamIdsByType:{běh:'a'},teamId:'a'} });
  assert.equal((await call(teams,{action:'join',teamId:'a'})).status,409);
  assert.equal((await call(teams,{action:'delete',teamId:'a'})).status,200);
  assert.equal(db.store.get('users/u').teamIdsByType.běh,'b');
  assert.equal(db.store.get('users/v').teamIdsByType.běh,null);
  assert.ok(!db.store.has('teams/a'));
});
test('APIs reject unauthenticated mutations', async () => {
  authenticated=false;
  try {
    assert.equal((await call(teams,{action:'create',name:'Tým'})).status,401);
    assert.equal((await call(challenges,{action:'create'})).status,401);
  } finally { authenticated=true; }
});
test('challenges: slash in name is safe, creator joins, duplicate name is rejected', async () => {
  db = new DB();
  const body={action:'create',name:'Běh / chůze',kind:'distance',activityType:'běh',goal:10,startDate:day(1),endDate:day(4)};
  const created=await call(challenges,body);
  assert.equal(created.status,200);
  assert.equal(db.store.get(`challenges/${created.body.id}/participants/u`).active,true);
  assert.equal((await call(challenges,body)).status,409);
});
test('challenges: membership is idempotent and rejoin resets the scoring boundary', async () => {
  db=new DB({'challenges/c':challenge()});
  await call(challenges,{action:'join',challengeId:'c'});
  await call(challenges,{action:'join',challengeId:'c'});
  assert.equal(db.store.get('challenges/c').participantCount,2);
  await call(challenges,{action:'leave',challengeId:'c'});
  await call(challenges,{action:'leave',challengeId:'c'});
  assert.equal(db.store.get('challenges/c').participantCount,1);
  await call(challenges,{action:'join',challengeId:'c'});
  assert.equal(db.store.get('challenges/c/participants/u').active,true);
  assert.ok(db.store.get('challenges/c/participants/u').joinedAt.toMillis() > Date.now()-5000);
});
test('challenges: edits and deletes are blocked by calendar date even if state is stale', async () => {
  db=new DB({'challenges/c':{...challenge(),state:'planned'}});
  assert.equal((await call(challenges,{action:'delete',challengeId:'c'})).status,409);
  assert.equal((await call(challenges,{action:'edit',challengeId:'c',name:'Test',kind:'distance',activityType:'běh',goal:5,startDate:day(1),endDate:day(2)})).status,409);
});
test('scoring: all goal types exclude old, future, invalid and other-activity runs', async () => {
  for (const [kind, expected] of [['distance',11],['sharedDistance',11],['activities',2],['activeDays',1]]) {
    db=new DB({'challenges/c':challenge(kind),'challenges/c/participants/u':{active:true,userId:'u',joinedAt:tsAt(-2)},
      'runs/a':{uid:'u',type:'běh',km:5,timestamp:tsAt(-1)},'runs/b':{uid:'u',type:'běh',km:6,timestamp:tsAt(-0.99)},
      'runs/old':{uid:'u',type:'běh',km:100,timestamp:tsAt(-3)},'runs/walk':{uid:'u',type:'chůze',km:100,timestamp:tsAt(-1)},
      'runs/future':{uid:'u',type:'běh',km:100,timestamp:tsAt(1)},'runs/invalid':{uid:'u',type:'běh',km:100,timestamp:'invalid'}});
    await scoring.reconcileChallengesForUser(db,'u');
    assert.equal(db.store.get('challenges/c/participants/u').result,expected,kind);
    if(kind==='sharedDistance')assert.equal(db.store.get('challenges/c').sharedProgress,11);
    db.store.delete('runs/a');
    await scoring.reconcileChallengesForUser(db,'u');
    assert.equal(db.store.get('challenges/c/participants/u').result,kind==='activities'||kind==='activeDays'?1:6);
  }
});
test('scoring: lifecycle refresh starts planned challenges and completes empty challenges', async () => {
  db=new DB({'challenges/start':{...challenge(),state:'planned'},'challenges/empty':{...challenge(),endDate:day(-1)}});
  assert.equal((await call(challenges,{action:'refresh'})).status,200);
  assert.equal(db.store.get('challenges/start').state,'active');
  assert.equal(db.store.get('challenges/empty').state,'completed');
});
test('scoring: 901 participants finalize safely, with completion written in the final batch', async () => {
  for(const kind of ['distance','sharedDistance']) {
    const seed={'challenges/c':{...challenge(kind),endDate:day(-1)}};
    for(let i=0;i<901;i++)seed[`challenges/c/participants/p${i}`]={active:true,joinedAt:tsAt(-3)};
    db=new DB(seed);
    const apply=db.apply.bind(db);
    db.apply=(r,d,m)=>{
      if(d.state==='completed')for(let i=0;i<901;i++)assert.ok(db.store.get(`challenges/c/participants/p${i}`).finalizedAt);
      apply(r,d,m);
    };
    await scoring.reconcileChallengeState(db,'c');
    assert.equal(db.store.get('challenges/c').state,'completed');
    assert.deepEqual(db.batchSizes,[450,450,2]);
  }
});
