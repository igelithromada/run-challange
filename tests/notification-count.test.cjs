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
  api.expireNotificationCount(one.uid);
  assert.equal(await api.loadNotificationCount(one), 2);
  assert.equal(await api.loadNotificationCount(one, true), 3);
  now += 30 * 60_000;
  assert.equal(await api.loadNotificationCount(one), 4);
  assert.equal(await api.loadNotificationCount(two), 5);
  assert.equal(api.cachedNotificationCount(one.uid), undefined);
  api.rememberNotificationCount(two.uid, 0);
  assert.equal(await api.loadNotificationCount(two), 0);
  api.clearNotificationCount();
  assert.equal(await api.loadNotificationCount(two), 6);
});

test('fresh reaction signals invalidate only the current recipient and deduplicate reconnects', () => {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('app/lib/freshReactionSignal.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let session, receive, disconnects = 0;
  const auth = {};
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const stale = [], events = [];
  vm.runInNewContext(code, {
    module, exports: module.exports, window, document, CustomEvent,
    require: name => ({
      'firebase/auth': { onAuthStateChanged(_auth, callback) { session = callback; return () => {}; } },
      'firebase/firestore': {
        doc: (_db, collection, uid) => collection + '/' + uid,
        onSnapshot(path, options, callback) {
          assert.equal(path, 'notificationSignals/' + auth.currentUser.uid);
          assert.equal(options.includeMetadataChanges, true);
          receive = (revision, fromCache = false) => callback({ data: () => ({ revision }), metadata: { fromCache } });
          return () => { disconnects++; };
        },
      },
      './firebase': { auth, db: {} },
      './notificationCount': { expireNotificationCount: uid => stale.push(uid) },
    })[name],
  });
  const api = module.exports;
  window.addEventListener(api.FRESH_REACTION, event => events.push(event.detail.uid));
  const unsubscribe = api.subscribeToFreshReactions();
  auth.currentUser = { uid: 'owner' };
  session(auth.currentUser);
  receive('cached', true);
  receive('one');
  receive('one');
  document.visibilityState = 'hidden';
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(disconnects, 1);
  document.visibilityState = 'visible';
  document.dispatchEvent(new Event('visibilitychange'));
  receive('one');
  receive('two');
  const staleCallback = receive;
  auth.currentUser = { uid: 'other' };
  session(auth.currentUser);
  staleCallback('private');
  receive('other-user');
  assert.deepEqual(events, ['owner', 'owner', 'other']);
  assert.deepEqual(stale, events);
  unsubscribe();
  assert.equal(disconnects, 3);
});
