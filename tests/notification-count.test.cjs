const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('notification count survives navigation, expires after 30 minutes and is scoped to the user', async () => {
  let now = 100, fetches = 0;
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('app/lib/notificationCount.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, Date: { now: () => now },
    fetch: async (url, request) => {
      assert.equal(url, '/api/notifications?view=count');
      assert.match(request.headers.Authorization, /^Bearer /);
      return Response.json({ unreadCount: ++fetches });
    },
  });
  const api = module.exports;
  const one = { uid: 'one', getIdToken: async () => 'one-token' };
  const two = { uid: 'two', getIdToken: async () => 'two-token' };
  const pending = api.loadNotificationCount(one);
  assert.strictEqual(api.loadNotificationCount(one), pending);
  assert.equal(await pending, 1);
  now += 29 * 60_000;
  assert.equal(await api.loadNotificationCount(one), 1);
  now += 60_000;
  assert.equal(await api.loadNotificationCount(one), 2);
  assert.equal(await api.loadNotificationCount(two), 3);
  assert.equal(api.cachedNotificationCount(one.uid), undefined);
  api.rememberNotificationCount(two.uid, 0);
  assert.equal(await api.loadNotificationCount(two), 0);
  api.clearNotificationCount();
  assert.equal(await api.loadNotificationCount(two), 4);
});
