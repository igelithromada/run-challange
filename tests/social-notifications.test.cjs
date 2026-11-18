const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), Module = require('node:module'), ts = require('typescript');
function load(file, auth) {
  const filename = path.resolve(file), module = { exports: {} }, req = Module.createRequire(filename);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, URL, console: { error() {} }, require: name => name.endsWith('/apiAuth') ? auth : name.endsWith('/runData') ? req(name + '.ts') : req(name) });
  return module.exports;
}
function fixture(preferences = {}) {
  let uid = 'wife', count = 0, failNotification = false;
  const records = new Map([['runs/run', { uid: 'owner', likedBy: [], commentCount: 0 }], ['users/owner', { socialNotifications: preferences }], ['publicProfiles/wife', { nickname: 'Verča' }]]);
  const snapshot = key => ({ id: key.split('/').pop(), exists: records.has(key), data: () => records.get(key) });
  const collection = prefix => ({ doc: id => { const key = `${prefix}/${id || ++count}`; return { key, get: async () => snapshot(key), collection: name => collection(`${key}/${name}`) }; }, where: (field, op, value) => ({ get: async () => ({ docs: [...records.keys()].filter(k => k.startsWith(`${prefix}/`) && records.get(k)[field] === value).map(snapshot) }) }) });
  const db = { collection, runTransaction: async fn => {
    const writes = [];
    const result = await fn({ get: async ref => snapshot(ref.key), update: (ref, data) => writes.push(() => records.set(ref.key, { ...records.get(ref.key), ...data })), set: (ref, data) => { if (failNotification && ref.key.startsWith('notifications/')) throw new Error('write failed'); writes.push(() => records.set(ref.key, data)); }, delete: ref => writes.push(() => records.delete(ref.key)) });
    writes.forEach(fn => fn()); return result;
  } };
  const auth = { requireUser: async () => ({ adminDb: db, decoded: { uid } }), authErrorResponse: () => null };
  const social = load('app/api/runs/social/route.ts', auth), notifications = load('app/api/notifications/route.ts', auth);
  return { records, setUid: value => uid = value, fail: () => failNotification = true, post: body => social.POST({ json: async () => ({ runId: 'run', ...body }) }), get: () => notifications.GET(new Request("https://example.test/api/notifications")) };
}
test('another account sees a like notification; removing the like removes the notification', async () => {
  const f = fixture();
  assert.equal((await f.post({ action: 'like' })).status, 200);
  f.setUid('owner');
  const response = await f.get(), body = await response.json();
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(body.unreadCount, 1); assert.equal(body.notifications[0].actorNickname, 'Verča'); assert.equal(body.notifications[0].runId, 'run');
  f.setUid('wife'); await f.post({ action: 'like' }); f.setUid('owner');
  assert.equal((await (await f.get()).json()).unreadCount, 0);
});
test('notification preferences are respected, and comments notify the activity owner', async () => {
  const f = fixture({ likes: false }); await f.post({ action: 'like' }); f.setUid('owner');
  assert.equal((await (await f.get()).json()).unreadCount, 0);
  f.setUid('wife'); assert.equal((await f.post({ action: 'comment', text: 'Super!' })).status, 200); f.setUid('owner');
  const body = await (await f.get()).json(); assert.equal(body.unreadCount, 1); assert.equal(body.notifications[0].type, 'social_comment');
});
test('a notification write failure cannot silently save a like without its notification', async () => {
  const f = fixture(); f.fail(); assert.equal((await f.post({ action: 'like' })).status, 500);
  assert.deepEqual(f.records.get('runs/run').likedBy, []);
});

test('recent reactions signal the recipient while older ones still go into the ordinary inbox', async () => {
  const recent = fixture();
  const run = recent.records.get('runs/run');
  run.createdAt = { toDate: () => new Date(Date.now() - 60_000) };
  run.timestamp = new Date(Date.now() - 48 * 3600_000).toISOString();
  assert.equal((await recent.post({ action: 'like' })).status, 200);
  const first = recent.records.get('notificationSignals/owner').revision;
  assert.ok(first);
  assert.equal(recent.records.has('notificationSignals/wife'), false);

  await recent.post({ action: 'like' });
  assert.notEqual(recent.records.get('notificationSignals/owner').revision, first);
  const afterUnlike = recent.records.get('notificationSignals/owner').revision;
  assert.equal((await recent.post({ action: 'comment', text: 'Super!' })).status, 200);
  assert.notEqual(recent.records.get('notificationSignals/owner').revision, afterUnlike);

  const old = fixture();
  old.records.get('runs/run').timestamp = new Date(Date.now() - 48 * 3600_000).toISOString();
  assert.equal((await old.post({ action: 'like' })).status, 200);
  old.setUid('owner');
  assert.equal((await (await old.get()).json()).unreadCount, 1);
  assert.equal(old.records.has('notificationSignals/owner'), false);

  const muted = fixture({ comments: false });
  muted.records.get('runs/run').timestamp = new Date().toISOString();
  await muted.post({ action: 'comment', text: 'Super!' });
  assert.equal(muted.records.has('notificationSignals/owner'), false);
});
